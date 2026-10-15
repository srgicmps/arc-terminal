import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { clearKeyCache, verifyAccess } from './access.ts';
import { handlePrefs, memoryStore, parsePatch } from './prefs.ts';

// Claves de prueba: un par RSA hecho al empezar, como el de Access. La «otra» firma tokens falsos.
const TEAM = 'https://prueba.cloudflareaccess.com';
const AUD = 'aud-de-prueba';
let mine: CryptoKeyPair;
let other: CryptoKeyPair;
let jwks: JsonWebKey[];

const b64url = (bytes: Uint8Array) =>
	btoa(String.fromCharCode(...bytes))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '');
const part = (o: object) => b64url(new TextEncoder().encode(JSON.stringify(o)));

async function sign(claims: Record<string, unknown>, key = mine.privateKey, kid = 'k1') {
	const now = Math.floor(Date.now() / 1000);
	const body = `${part({ alg: 'RS256', kid, typ: 'JWT' })}.${part({ aud: [AUD], iss: TEAM, exp: now + 3600, iat: now, ...claims })}`;
	const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(body));
	return `${body}.${b64url(new Uint8Array(sig))}`;
}

const certs = async (url: string) => {
	expect(url).toBe(`${TEAM}/cdn-cgi/access/certs`);
	return new Response(JSON.stringify({ keys: jwks }));
};

const ALG = {
	name: 'RSASSA-PKCS1-v1_5',
	modulusLength: 2048,
	publicExponent: new Uint8Array([1, 0, 1]),
	hash: 'SHA-256'
};

beforeAll(async () => {
	mine = (await crypto.subtle.generateKey(ALG, true, ['sign', 'verify'])) as CryptoKeyPair;
	other = (await crypto.subtle.generateKey(ALG, true, ['sign', 'verify'])) as CryptoKeyPair;
	jwks = [{ ...(await crypto.subtle.exportKey('jwk', mine.publicKey)), kid: 'k1' } as JsonWebKey];
});
beforeEach(clearKeyCache);

const config = { teamDomain: 'prueba.cloudflareaccess.com', aud: AUD };

describe('verifyAccess', () => {
	it('da el email de un token bueno', async () => {
		expect(await verifyAccess(await sign({ email: 'Ana@Ejemplo.com' }), config, certs)).toBe('ana@ejemplo.com');
	});
	it('rechaza firma de otra clave, otra audiencia, otro emisor, caducado o sin email', async () => {
		const bad = [
			await sign({ email: 'a@b.c' }, other.privateKey),
			await sign({ email: 'a@b.c', aud: ['otra'] }),
			await sign({ email: 'a@b.c', iss: 'https://otro.cloudflareaccess.com' }),
			await sign({ email: 'a@b.c', exp: Math.floor(Date.now() / 1000) - 10 }),
			await sign({ common_name: 'token-de-servicio' }),
			await sign({ email: 'a@b.c' }, mine.privateKey, 'desconocida'),
			'no.es.un-jwt',
			''
		];
		for (const t of bad) expect(await verifyAccess(t, config, certs)).toBeNull();
	});
	it('rechaza un token con el email cambiado a mano (la firma ya no cuadra)', async () => {
		const [h, , s] = (await sign({ email: 'ana@ejemplo.com' })).split('.');
		const now = Math.floor(Date.now() / 1000);
		const forged = `${h}.${part({ aud: [AUD], iss: TEAM, exp: now + 3600, email: 'luis@ejemplo.com' })}.${s}`;
		expect(await verifyAccess(forged, config, certs)).toBeNull();
	});
});

describe('handlePrefs', () => {
	const env = { ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD };
	const req = async (email: string | null, method = 'GET', body?: unknown, headers: Record<string, string> = {}) =>
		new Request('https://arcterminal.dev/api/prefs', {
			method,
			headers: {
				...(email ? { 'cf-access-jwt-assertion': await sign({ email }) } : {}),
				...(body ? { 'content-type': 'application/json' } : {}),
				...headers
			},
			body: body ? JSON.stringify(body) : undefined
		});

	it('cada usuario solo ve y cambia lo suyo', async () => {
		const store = memoryStore();
		const put = async (email: string, set: Record<string, string>) =>
			(await handlePrefs(await req(email, 'PUT', { set }), env, store, certs)).status;
		expect(await put('ana@x.es', { 'arc-accent': 'cyan', 'arc-watchwords': '["paro"]' })).toBe(200);
		expect(await put('luis@x.es', { 'arc-accent': 'blue' })).toBe(200);
		const ana = await (await handlePrefs(await req('ana@x.es'), env, store, certs)).json();
		const luis = await (await handlePrefs(await req('luis@x.es'), env, store, certs)).json();
		expect(ana).toEqual({ user: 'ana@x.es', prefs: { 'arc-accent': 'cyan', 'arc-watchwords': '["paro"]' } });
		expect(luis).toEqual({ user: 'luis@x.es', prefs: { 'arc-accent': 'blue' } });
		// Borrar una clave de Luis no toca la de Ana.
		await handlePrefs(await req('luis@x.es', 'PUT', { del: ['arc-accent'] }), env, store, certs);
		expect(store.rows.get('luis@x.es')).toEqual({});
		expect(store.rows.get('ana@x.es')?.['arc-accent']).toBe('cyan');
	});

	it('sin token, con un email suelto en la cabecera o desde otra web: no', async () => {
		const store = memoryStore();
		expect(
			(
				await handlePrefs(
					await req(null, 'GET', undefined, { 'cf-access-authenticated-user-email': 'ana@x.es' }),
					env,
					store,
					certs
				)
			).status
		).toBe(401);
		expect(
			(
				await handlePrefs(
					await req('ana@x.es', 'GET', undefined, { origin: 'https://malo.example' }),
					env,
					store,
					certs
				)
			).status
		).toBe(403);
	});

	it('sin base o sin AUD configurados responde 503', async () => {
		expect((await handlePrefs(await req('ana@x.es'), env, null, certs)).status).toBe(503);
		expect((await handlePrefs(await req('ana@x.es'), { ACCESS_TEAM_DOMAIN: TEAM }, memoryStore(), certs)).status).toBe(
			503
		);
	});

	it('pone límites: claves desconocidas, valores enormes, total del usuario', async () => {
		const store = memoryStore();
		const status = async (set: Record<string, string>) =>
			(await handlePrefs(await req('ana@x.es', 'PUT', { set }), env, store, certs)).status;
		expect(await status({ 'otra-cosa': '1' })).toBe(400);
		expect(await status({ 'arc-localwx:1,2': '{}' })).toBe(400); // una caché: no se guarda
		expect(await status({ 'arc-chess': 'x'.repeat(70_000) })).toBe(400);
		const big = Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`arc-layout-v${i}`, 'x'.repeat(60_000)]));
		expect(await status(big)).toBe(413);
		expect(store.rows.size).toBe(0);
	});
});

describe('parsePatch', () => {
	it('acepta set y del vacíos y rechaza formas raras', () => {
		expect(parsePatch({})).toEqual({ set: {}, del: [] });
		expect(typeof parsePatch([])).toBe('string');
		expect(typeof parsePatch({ set: [] })).toBe('string');
		expect(typeof parsePatch({ set: { 'arc-theme': 1 } })).toBe('string');
	});
});
