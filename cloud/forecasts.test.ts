import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { clearKeyCache } from './access.ts';
import { handleForecasts, memoryForecastStore } from './forecasts.ts';
import { ENV, testKeys } from './testkeys.ts';

let k: Awaited<ReturnType<typeof testKeys>>;
beforeAll(async () => void (k = await testKeys()));
beforeEach(clearKeyCache);

const NOW = Date.parse('2026-10-15T10:00:00Z');
const OPEN = 'es-ipc@2026-10-30T08:00Z';
const CLOSED = 'us-cpi@2026-10-14T12:30Z';

const call = async (store: ReturnType<typeof memoryForecastStore>, who: Record<string, unknown> | null, method = 'GET', body?: unknown, query = '', now = NOW) =>
	handleForecasts(
		new Request(`https://arcterminal.dev/api/forecasts${query}`, {
			method,
			headers: {
				...(who ? { 'cf-access-jwt-assertion': await k.sign(who) } : {}),
				...(body ? { 'content-type': 'application/json' } : {})
			},
			body: body ? JSON.stringify(body) : undefined
		}),
		ENV,
		store,
		k.certs,
		now
	);

const ana = { email: 'ana@x.es' };
const luis = { email: 'luis@x.es' };

describe('/api/forecasts', () => {
	it('sin identificar, 401; el token de servicio no juega; sin base, 503', async () => {
		const store = memoryForecastStore();
		expect((await call(store, null)).status).toBe(401);
		expect((await call(store, { common_name: 'svc.access' })).status).toBe(403);
		expect((await handleForecasts(new Request('https://arcterminal.dev/api/forecasts'), ENV, null)).status).toBe(503);
	});

	it('apuesta en rondas abiertas, no en cerradas, y valida lo que llega', async () => {
		const store = memoryForecastStore();
		expect((await call(store, ana, 'PUT', { round: OPEN, value: 2.94 })).status).toBe(200);
		expect((await call(store, ana, 'PUT', { round: OPEN, value: 3.1 })).status).toBe(200);
		expect((await call(store, ana, 'PUT', { round: CLOSED, value: 3 })).status).toBe(409);
		expect((await call(store, ana, 'PUT', { round: 'raro', value: 3 })).status).toBe(400);
		expect((await call(store, ana, 'PUT', { round: OPEN, value: 'x' })).status).toBe(400);
		expect((await call(store, ana, 'PUT', { round: OPEN, value: 1e9 })).status).toBe(400);
		const body = await (await call(store, ana)).json();
		expect(body.bets).toEqual([{ round: OPEN, value: 3.1, uid: body.me.uid, alias: null }]);
		expect(body.me.uid).toMatch(/^[0-9a-f]{16}$/);
		expect(JSON.stringify(body)).not.toContain('@x.es');
	});

	it('las apuestas de los demás solo se ven cuando la ronda ha cerrado, con apodo y sin email', async () => {
		const store = memoryForecastStore();
		await call(store, luis, 'PUT', { alias: 'Luisito' });
		await call(store, luis, 'PUT', { round: OPEN, value: 2.5 });
		const before = await (await call(store, ana)).json();
		expect(before.bets).toEqual([]);
		const later = Date.parse('2026-10-30T09:00:00Z');
		const after = await (await call(store, ana, 'GET', undefined, '', later)).json();
		expect(after.bets).toEqual([expect.objectContaining({ round: OPEN, value: 2.5, alias: 'Luisito' })]);
		expect(JSON.stringify(after)).not.toContain('luis@');
	});

	it('apodo: se valida y se puede quitar; borrar una apuesta solo si sigue abierta', async () => {
		const store = memoryForecastStore();
		expect((await call(store, ana, 'PUT', { alias: '<script>' })).status).toBe(400);
		expect((await (await call(store, ana, 'PUT', { alias: 'Ana G.' })).json()).me.alias).toBe('Ana G.');
		expect((await (await call(store, ana, 'PUT', { alias: '' })).json()).me.alias).toBeNull();
		await call(store, ana, 'PUT', { round: OPEN, value: 3 });
		expect((await call(store, ana, 'DELETE', undefined, `?round=${encodeURIComponent(OPEN)}`)).status).toBe(200);
		expect((await call(store, ana, 'DELETE', undefined, `?round=${encodeURIComponent(CLOSED)}`)).status).toBe(409);
		expect((await (await call(store, ana)).json()).bets).toEqual([]);
	});
});
