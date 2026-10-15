import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { clearKeyCache } from './access.ts';
import { handleAlerts, memoryAlertStore } from './alerts.ts';
import { ENV, testKeys } from './testkeys.ts';

let k: Awaited<ReturnType<typeof testKeys>>;
beforeAll(async () => void (k = await testKeys()));
beforeEach(clearKeyCache);

const call = async (
	store: ReturnType<typeof memoryAlertStore>,
	who: Record<string, unknown> | null,
	method = 'GET',
	body?: unknown,
	query = ''
) =>
	handleAlerts(
		new Request(`https://arcterminal.dev/api/alerts${query}`, {
			method,
			headers: {
				...(who ? { 'cf-access-jwt-assertion': await k.sign(who) } : {}),
				...(body ? { 'content-type': 'application/json' } : {})
			},
			body: body ? JSON.stringify(body) : undefined
		}),
		ENV,
		store,
		k.certs
	);

describe('/api/alerts', () => {
	it('al activar, cada uno tiene su tema, largo y distinto; sin activar, ninguno', async () => {
		const store = memoryAlertStore();
		const off = await (await call(store, { email: 'luis@x.es' }, 'PUT', { config: { on: false } })).json();
		expect(off.topic).toBeNull();
		const ana = await (await call(store, { email: 'ana@x.es' }, 'PUT', { config: { on: true, level: 2 } })).json();
		const luis = await (await call(store, { email: 'luis@x.es' }, 'PUT', { config: { on: true } })).json();
		expect(ana.topic).toMatch(/^arc-[0-9a-f]{32}$/);
		expect(luis.topic).toMatch(/^arc-[0-9a-f]{32}$/);
		expect(ana.topic).not.toBe(luis.topic);
		// Guardar otra vez no cambia el tema; «rotate» sí.
		const again = await (await call(store, { email: 'ana@x.es' }, 'PUT', { config: { on: true, level: 3 } })).json();
		expect(again.topic).toBe(ana.topic);
		const rotated = await (
			await call(store, { email: 'ana@x.es' }, 'PUT', { config: { on: true }, rotate: true })
		).json();
		expect(rotated.topic).not.toBe(ana.topic);
	});

	it('cada persona solo ve lo suyo, y nadie con email puede pedir la lista', async () => {
		const store = memoryAlertStore();
		await call(store, { email: 'ana@x.es' }, 'PUT', { config: { on: true, mis: ['nvda'] } });
		const luis = await (await call(store, { email: 'luis@x.es' })).json();
		expect(luis.topic).toBeNull();
		expect(luis.config.mis).toEqual([]);
		expect((await call(store, { email: 'ana@x.es' }, 'GET', undefined, '?all=1')).status).toBe(403);
	});

	it('la Action (token de servicio) lee la lista sin emails; no puede escribir', async () => {
		const store = memoryAlertStore();
		await call(store, { email: 'ana@x.es' }, 'PUT', { config: { on: true } });
		await call(store, { email: 'luis@x.es' }, 'PUT', { config: { on: false } });
		const res = await call(store, { common_name: 'abc.access' }, 'GET', undefined, '?all=1');
		const text = await res.text();
		expect(res.status).toBe(200);
		expect(text).not.toContain('@');
		const { users } = JSON.parse(text);
		expect(users).toHaveLength(1);
		expect(users[0].topic).toMatch(/^arc-/);
		expect((await call(store, { common_name: 'abc.access' }, 'PUT', { config: { on: true } })).status).toBe(403);
	});

	it('sin JWT, o con uno firmado por otra clave: 401', async () => {
		const store = memoryAlertStore();
		expect((await call(store, null, 'GET', undefined, '?all=1')).status).toBe(401);
		const forged = await k.sign({ common_name: 'x' }, k.other);
		const res = await handleAlerts(
			new Request('https://arcterminal.dev/api/alerts?all=1', { headers: { 'cf-access-jwt-assertion': forged } }),
			ENV,
			store,
			k.certs
		);
		expect(res.status).toBe(401);
	});

	it('DELETE lo borra todo (tema incluido)', async () => {
		const store = memoryAlertStore();
		await call(store, { email: 'ana@x.es' }, 'PUT', { config: { on: true } });
		await call(store, { email: 'ana@x.es' }, 'DELETE');
		expect(store.rows.size).toBe(0);
	});
});
