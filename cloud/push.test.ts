// /api/push (cloud/push.ts) con una D1 de verdad sobre SQLite (d1sqlite.ts) y JWT de Access de prueba. Los envíos
// a los servicios de push no salen: los recoge un fetch de mentira.
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { parseConfig } from '../src/lib/alertconfig.ts';
import { clearKeyCache } from './access.ts';
import { d1AlertStore } from './alerts.ts';
import { sqliteD1 } from './d1sqlite.ts';
import { cleanMessage, cleanSub, d1PushStore, handlePush, payloadOf, PUSH_LIMITS } from './push.ts';
import { resetSchema } from './schema.ts';
import { ENV, testKeys } from './testkeys.ts';
import { generateVapid, MAX_PLAINTEXT } from './webpush.ts';

let k: Awaited<ReturnType<typeof testKeys>>;
let secret = '';
let publicKey = '';
beforeAll(async () => {
	k = await testKeys();
	const v = await generateVapid();
	secret = JSON.stringify(v.jwk);
	publicKey = v.public;
});
beforeEach(() => {
	clearKeyCache();
	resetSchema();
});

/** Claves de un navegador de verdad (las del ejemplo de RFC 8291). */
const KEYS = {
	p256dh: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
	auth: 'BTBZMqHH6r4Tts7J_aSIgg'
};
const sub = (id: string, host = 'fcm.googleapis.com') => ({ endpoint: `https://${host}/fcm/send/${id}`, keys: KEYS });
const UID_ANA = 'a'.repeat(16);

function setup(env: Record<string, unknown> = {}) {
	const db = sqliteD1();
	const store = d1PushStore(db);
	const sent: { url: string; headers: Record<string, string> }[] = [];
	/** Lo que responde cada endpoint (por defecto, 201 como FCM). */
	const status: Record<string, number> = {};
	const sender = async (url: string, init?: RequestInit) => {
		sent.push({ url, headers: init!.headers as Record<string, string> });
		return new Response(null, { status: status[url] ?? 201 });
	};
	const call = async (
		who: string | null,
		method = 'GET',
		body?: unknown,
		query = '',
		extra: { origin?: string; raw?: string } = {}
	) => {
		const token = who === null ? null : await k.sign(who === 'svc' ? { common_name: 'svc.access' } : { email: who });
		const headers: Record<string, string> = {};
		if (token) headers['cf-access-jwt-assertion'] = token;
		if (extra.origin) headers.origin = extra.origin;
		if (body !== undefined || extra.raw) headers['content-type'] = 'application/json';
		const request = new Request(`https://arcterminal.dev/api/push${query}`, {
			method,
			headers,
			body: extra.raw ?? (body === undefined ? undefined : JSON.stringify(body))
		});
		return handlePush(request, { ...ENV, DB: db, VAPID_PRIVATE_KEY: secret, ...env }, store, k.certs, sender);
	};
	const avisos = (user: string, uid: string) =>
		d1AlertStore(db).put(user, { uid, topic: `arc-${'0'.repeat(32)}`, config: parseConfig({ on: true }) });
	return { db, store, sent, status, call, avisos };
}

describe('/api/push: una persona', () => {
	it('sin JWT, 401; desde otra web, 403; sin el Secret, 503 (y la fila de AVISOS no sale)', async () => {
		const { call } = setup();
		expect((await call(null)).status).toBe(401);
		expect((await call('ana@x.es', 'GET', undefined, '', { origin: 'https://malo.example' })).status).toBe(403);
		const none = setup({ VAPID_PRIVATE_KEY: undefined });
		const res = await none.call('ana@x.es');
		expect(res.status).toBe(503);
		expect(await res.json()).toEqual({ error: 'sin claves' });
	});

	it('GET: la clave pública (la del Secret) y cuántos navegadores tiene, nunca sus endpoints', async () => {
		const { call } = setup();
		expect(await (await call('ana@x.es')).json()).toEqual({ key: publicKey, count: 0, max: 5 });
		await call('ana@x.es', 'PUT', sub('uno'));
		const text = await (await call('ana@x.es')).text();
		expect(JSON.parse(text).count).toBe(1);
		expect(text).not.toContain('fcm');
	});

	it('PUT: solo servicios de push conocidos, https, claves P-256 y como mucho 1 KB', async () => {
		const { call } = setup();
		const bad = async (body: unknown, raw?: string) => (await call('ana@x.es', 'PUT', body, '', raw ? { raw } : {})).status;
		expect(await bad(sub('x', 'malo.example'))).toBe(400);
		expect(await bad(sub('x', 'fcm.googleapis.com.malo.example'))).toBe(400);
		expect(await bad({ ...sub('x'), endpoint: 'http://fcm.googleapis.com/x' })).toBe(400);
		expect(await bad({ ...sub('x'), keys: { ...KEYS, p256dh: 'AAAA' } })).toBe(400);
		expect(await bad({ ...sub('x'), keys: { ...KEYS, auth: 'AAAA' } })).toBe(400);
		expect(await bad(undefined, JSON.stringify({ ...sub('x'), pad: 'x'.repeat(PUSH_LIMITS.sub) }))).toBe(413);
		for (const host of ['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'web.push.apple.com', 'wns2-par02p.notify.windows.com'])
			expect(await bad(sub('ok', host)), host).toBe(200);
	});

	it('como mucho 5 navegadores: el sexto deja fuera al más antiguo', async () => {
		const { call, store } = setup();
		for (const id of ['1', '2', '3', '4', '5', '6']) await call('ana@x.es', 'PUT', sub(id));
		const ids = (await store.mine('ana@x.es')).map((s) => s.endpoint.split('/').pop());
		expect(ids.sort()).toEqual(['2', '3', '4', '5', '6']);
	});

	it('DELETE y la prueba solo valen con un navegador suyo', async () => {
		const { call, store, sent } = setup();
		await call('ana@x.es', 'PUT', sub('ana'));
		await call('luis@x.es', 'PUT', sub('luis'));
		// Luis no puede quitar ni probar el de Ana.
		expect((await call('luis@x.es', 'DELETE', { endpoint: sub('ana').endpoint })).status).toBe(200);
		expect(await store.mine('ana@x.es')).toHaveLength(1);
		expect((await call('luis@x.es', 'POST', { endpoint: sub('ana').endpoint }, '?test=1')).status).toBe(404);
		expect(sent).toHaveLength(0);
		// Ana sí.
		const test = await call('ana@x.es', 'POST', { endpoint: sub('ana').endpoint }, '?test=1');
		expect(await test.json()).toEqual({ sent: 1, gone: 0 });
		expect(sent.map((s) => s.url)).toEqual([sub('ana').endpoint]);
		expect(sent[0].headers.authorization).toMatch(new RegExp(`^vapid t=.+, k=${publicKey}$`));
		expect(sent[0].headers['content-encoding']).toBe('aes128gcm');
		await call('ana@x.es', 'DELETE', { endpoint: sub('ana').endpoint });
		expect(await store.mine('ana@x.es')).toEqual([]);
	});

	it('una persona no puede leer la lista de la Action ni mandar avisos', async () => {
		const { call, avisos, sent } = setup();
		await avisos('ana@x.es', UID_ANA);
		await call('ana@x.es', 'PUT', sub('ana'));
		expect((await call('luis@x.es', 'GET', undefined, '?all=1')).status).toBe(403);
		const res = await call('luis@x.es', 'POST', { uid: UID_ANA, title: 'Hola', url: '/' }, '?send=1');
		expect(res.status).toBe(403);
		expect(sent).toHaveLength(0);
	});
});

describe('/api/push: la Action', () => {
	it('?all=1: los uid con navegador (sin emails ni endpoints)', async () => {
		const { call, avisos } = setup();
		await avisos('ana@x.es', UID_ANA);
		await avisos('luis@x.es', 'b'.repeat(16));
		await call('ana@x.es', 'PUT', sub('ana'));
		await call('eva@x.es', 'PUT', sub('eva')); // sin avisos: no tiene uid
		expect(await (await call('svc', 'GET', undefined, '?all=1')).json()).toEqual({ uids: [UID_ANA] });
	});

	it('?send=1: a todos sus navegadores; los 404/410 se borran; solo cuentas en la respuesta', async () => {
		const { call, avisos, sent, status, store } = setup();
		await avisos('ana@x.es', UID_ANA);
		await call('ana@x.es', 'PUT', sub('vivo'));
		await call('ana@x.es', 'PUT', sub('muerto', 'web.push.apple.com'));
		await call('ana@x.es', 'PUT', sub('caido'));
		await call('luis@x.es', 'PUT', sub('luis'));
		status[sub('muerto', 'web.push.apple.com').endpoint] = 410;
		status[sub('caido').endpoint] = 500;
		const res = await call('svc', 'POST', { uid: UID_ANA, title: 'Terremoto', body: 'M 6,1', url: '/geo', level: 1 }, '?send=1');
		const text = await res.text();
		expect(res.status).toBe(200);
		expect(JSON.parse(text)).toEqual({ sent: 1, gone: 1, codes: { 201: 1, 410: 1, 500: 1 } });
		expect(text).not.toContain('http');
		expect(sent.map((s) => s.url).sort()).toEqual([sub('caido').endpoint, sub('muerto', 'web.push.apple.com').endpoint, sub('vivo').endpoint].sort());
		expect(sent.every((s) => s.headers.urgency === 'high')).toBe(true);
		// El 410 se borra; el 500 se queda (puede ser pasajero); el de Luis, ni se toca.
		expect((await store.mine('ana@x.es')).map((s) => s.endpoint.split('/').pop()).sort()).toEqual(['caido', 'vivo']);
		expect(await store.mine('luis@x.es')).toHaveLength(1);
	});

	it('?send=1 con un aviso mal formado: 400, sin enviar nada', async () => {
		const { call, sent } = setup();
		for (const body of [{ uid: 'x', title: 'a' }, { uid: UID_ANA }, { uid: UID_ANA, title: 'a', url: 'javascript:alert(1)' }])
			expect((await call('svc', 'POST', body, '?send=1')).status).toBe(400);
		expect(sent).toHaveLength(0);
	});
});

describe('el mensaje', () => {
	it('cleanSub normaliza y cleanMessage resuelve la vista con el origen de la web', () => {
		expect(cleanSub(sub('a'))).toEqual({ endpoint: sub('a').endpoint, ...KEYS });
		expect(cleanSub({ endpoint: 'https://user:pw@fcm.googleapis.com/x', keys: KEYS })).toBe('endpoint no válido');
		expect(cleanMessage({ title: ' Hola\u0007 ', body: 'a\nb', url: '/imp' }, 'https://arcterminal.dev')).toEqual({
			title: 'Hola',
			body: 'a\nb',
			url: 'https://arcterminal.dev/imp'
		});
	});

	it('payloadOf recorta el texto hasta que quepa cifrado en un registro', () => {
		const long = { title: 'T', body: 'ñ'.repeat(PUSH_LIMITS.body), url: `https://arcterminal.dev/${'x'.repeat(PUSH_LIMITS.url)}` };
		const text = payloadOf({ ...long, body: 'ñ€'.repeat(2000) });
		expect(new TextEncoder().encode(text).length).toBeLessThanOrEqual(MAX_PLAINTEXT);
		expect(JSON.parse(text).body.endsWith('…')).toBe(true);
		expect(payloadOf({ title: 'T', body: 'corto', url: 'https://arcterminal.dev/' })).toBe(
			JSON.stringify({ title: 'T', body: 'corto', url: 'https://arcterminal.dev/' })
		);
	});
});
