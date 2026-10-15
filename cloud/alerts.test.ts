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

describe('/api/alerts: alertas de precio (F14)', () => {
	const ADMIN = { ...ENV, ADMIN_EMAIL: 'Sergi@x.es' };
	const svc = { common_name: 'abc.access' };
	const req = async (store: ReturnType<typeof memoryAlertStore>, who: Record<string, unknown>, method: string, query = '', body?: unknown) =>
		handleAlerts(
			new Request(`https://arcterminal.dev/api/alerts${query}`, {
				method,
				headers: { 'cf-access-jwt-assertion': await k.sign(who), ...(body ? { 'content-type': 'application/json' } : {}) },
				body: body ? JSON.stringify(body) : undefined
			}),
			ADMIN,
			store,
			k.certs
		);
	const nvda = { id: 'aaaa0001', asset: 'NVDA', name: 'NVDA', unit: '$', op: '>', value: 150 };

	it('cada uno guarda las suyas; lo que no es una alerta válida no entra', async () => {
		const store = memoryAlertStore();
		const bad = { ...nvda, id: 'x', asset: '<script>' };
		const body = await (await req(store, { email: 'ana@x.es' }, 'PUT', '', { config: { on: true, prices: [nvda, bad], words: ['aranceles', 'Aranceles'] } })).json();
		expect(body.config.prices).toEqual([nvda]);
		expect(body.config.words).toEqual(['Aranceles']);
		expect((await (await req(store, { email: 'luis@x.es' }, 'GET')).json()).config.prices).toEqual([]);
	});

	it('la lista lleva la cuenta del administrador aunque no tenga avisos, marcada y sin email', async () => {
		const store = memoryAlertStore();
		await req(store, { email: 'sergi@x.es' }, 'PUT', '', { config: { on: false, prices: [nvda] } });
		const text = await (await req(store, svc, 'GET', '?all=1')).text();
		expect(text).not.toContain('@');
		const { users } = JSON.parse(text);
		expect(users).toHaveLength(1);
		expect(users[0]).toMatchObject({ admin: true, topic: null });
	});

	it('la Action borra las alertas que ya han avisado, y solo esas', async () => {
		const store = memoryAlertStore();
		const btc = { id: 'bbbb0002', asset: 'coin:bitcoin', name: 'Bitcoin', unit: '$', op: '%', value: -5 };
		await req(store, { email: 'ana@x.es' }, 'PUT', '', { config: { on: true, prices: [nvda, btc] } });
		const uid = store.rows.get('ana@x.es')!.uid;
		const res = await (await req(store, svc, 'POST', '?fired=1', { fired: [{ uid, ids: ['aaaa0001'] }, { uid: 'nadie', ids: ['x'] }] })).json();
		expect(res.removed).toBe(1);
		expect(store.rows.get('ana@x.es')!.config.prices.map((p) => p.id)).toEqual(['bbbb0002']);
	});

	it('la migración de los issues va a la cuenta del administrador, sumando a lo que tenga', async () => {
		const store = memoryAlertStore();
		await req(store, { email: 'sergi@x.es' }, 'PUT', '', { config: { on: true, words: ['vivienda'], mis: ['AAPL'] } });
		const res = await req(store, svc, 'POST', '?migrate=1', { prices: [nvda], mis: ['NVDA'], words: ['aranceles'] });
		expect(res.status).toBe(200);
		const c = store.rows.get('sergi@x.es')!.config;
		expect(c.prices).toEqual([nvda]);
		expect(c.words).toEqual(['vivienda', 'aranceles']);
		expect(c.mis).toEqual(['AAPL', 'NVDA']);
		expect(c.on).toBe(true);
	});

	it('una persona no puede borrar ni migrar; la Action no puede hacer otra cosa', async () => {
		const store = memoryAlertStore();
		expect((await req(store, { email: 'ana@x.es' }, 'POST', '?fired=1', { fired: [] })).status).toBe(405);
		expect((await req(store, { email: 'ana@x.es' }, 'POST', '?migrate=1', { prices: [] })).status).toBe(405);
		expect((await req(store, svc, 'POST', '', {})).status).toBe(403);
		expect((await req(store, svc, 'DELETE')).status).toBe(403);
	});
});
