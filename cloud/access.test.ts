// identity() y person() (cloud/access.ts): lo primero que hace cada Function. Importa el orden de las respuestas:
// 503 sin configurar, antes de mirar el origen; 403 si viene de otra web, antes de mirar el token; 401 sin
// identificar; y, solo en person(), 403 a los tokens de servicio.
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { clearKeyCache, identity, person } from './access.ts';
import { ENV, testKeys } from './testkeys.ts';

let k: Awaited<ReturnType<typeof testKeys>>;
beforeAll(async () => void (k = await testKeys()));
beforeEach(clearKeyCache);

const URL_API = 'https://arcterminal.dev/api/algo';
const req = (headers: Record<string, string> = {}) => new Request(URL_API, { method: 'POST', headers });
const status = (r: unknown) => (r instanceof Response ? r.status : 'ok');
const error = async (r: unknown) => (r instanceof Response ? ((await r.json()) as { error: string }).error : null);

describe.each([
	['identity', identity],
	['person', person]
] as const)('%s', (_, check) => {
	it('sin configurar, 503, aunque venga de otra web o sin token', async () => {
		for (const env of [{}, { ACCESS_TEAM_DOMAIN: ENV.ACCESS_TEAM_DOMAIN }, { ACCESS_AUD: ENV.ACCESS_AUD }]) {
			const r = await check(req({ origin: 'https://malo.example' }), env, k.certs);
			expect(status(r)).toBe(503);
			expect(await error(r)).toBe('sin configurar');
		}
	});

	it('desde otra web, 403 aunque el JWT sea bueno', async () => {
		const token = await k.sign({ email: 'ana@x.es' });
		for (const origin of ['https://malo.example', 'http://arcterminal.dev', 'https://arcterminal.dev.malo.example']) {
			const r = await check(req({ origin, 'cf-access-jwt-assertion': token }), ENV, k.certs);
			expect(status(r)).toBe(403);
			expect(await error(r)).toBe('origen');
		}
		// Desde otra web y sin token: también 403 (el origen va antes).
		expect(status(await check(req({ origin: 'https://malo.example' }), ENV, k.certs))).toBe(403);
	});

	it('sin JWT, con uno de otra clave o con una cabecera de email suelta, 401', async () => {
		const cases: Record<string, string>[] = [
			{},
			{ 'cf-access-jwt-assertion': await k.sign({ email: 'ana@x.es' }, k.other) },
			{ 'cf-access-jwt-assertion': 'no.es.jwt' },
			{ 'cf-access-authenticated-user-email': 'ana@x.es' }
		];
		for (const headers of cases) {
			const r = await check(req(headers), ENV, k.certs);
			expect(status(r)).toBe(401);
			expect(await error(r)).toBe('sin identificar');
		}
	});

	it('una persona: su email en minúsculas, por la cabecera o por la cookie, y desde la misma web', async () => {
		const token = await k.sign({ email: 'Ana@X.es' });
		const cases: Record<string, string>[] = [
			{ 'cf-access-jwt-assertion': token },
			{ cookie: `otra=1; CF_Authorization=${token}` },
			{ 'cf-access-jwt-assertion': token, origin: 'https://arcterminal.dev' }
		];
		for (const headers of cases) expect(await check(req(headers), ENV, k.certs)).toEqual({ email: 'ana@x.es' });
	});
});

describe('tokens de servicio (las Actions)', () => {
	it('identity() los deja pasar; person() responde 403 «solo personas»', async () => {
		const headers = { 'cf-access-jwt-assertion': await k.sign({ common_name: 'svc.access' }) };
		expect(await identity(req(headers), ENV, k.certs)).toEqual({ service: 'svc.access' });
		const r = await person(req(headers), ENV, k.certs);
		expect(status(r)).toBe(403);
		expect(await error(r)).toBe('solo personas');
	});
});
