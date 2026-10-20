// «Borrar mi cuenta» (DELETE /api/account) con el SQL de verdad (D1 de mentira sobre SQLite) y JWT de Access firmados
// con las claves de prueba: borra solo las filas de quien lo pide, y nada sin identidad, desde otra web o sin confirmar.
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { parseConfig } from '../src/lib/alertconfig.ts';
import { handleAccount } from './account.ts';
import { clearKeyCache } from './access.ts';
import { d1AdminStore, touchSeen, USER_TABLES } from './admin.ts';
import { d1AlertStore } from './alerts.ts';
import { sqliteD1 } from './d1sqlite.ts';
import { d1FamilyStore } from './family.ts';
import { d1FeedbackStore } from './feedback.ts';
import { d1ForecastStore } from './forecasts.ts';
import { d1Store } from './prefs.ts';
import { d1RssStore } from './rss.ts';
import { resetSchema } from './schema.ts';
import { ENV, testKeys } from './testkeys.ts';

let k: Awaited<ReturnType<typeof testKeys>>;
beforeAll(async () => void (k = await testKeys()));
beforeEach(() => {
	clearKeyCache();
	resetSchema();
});

const ANA = 'ana@x.es';
const BOB = 'bob@x.es';

/** Una fila de cada tabla de USER_TABLES para cada uno. */
async function seed(db: ReturnType<typeof sqliteD1>) {
	for (const user of [ANA, BOB]) {
		await d1Store(db).patch(user, { 'arc-mortgage': '{"capital":150000}' }, []);
		await d1AlertStore(db).put(user, { uid: user[0].repeat(16), topic: `arc-${user[0]}`, config: parseConfig({ on: true }) });
		await touchSeen(db, user);
		await d1FamilyStore(db).put(user, { id: user[0].repeat(16), name: user, accept: true });
		await d1FamilyStore(db).logSent(user, Date.now());
		await d1RssStore(db).put(user, ['https://example.com/feed.xml']);
		await d1ForecastStore(db).setPlayer(user, { uid: user[0].repeat(16), alias: null });
		await d1ForecastStore(db).setBet(user, { round: 'us10@2026-10-30T08:00Z', value: 4.1 });
		await d1FeedbackStore(db).add({ user, view: '/eco', text: 'Una idea', at: Date.now() });
	}
}

const left = (db: ReturnType<typeof sqliteD1>, table: string, user: string) =>
	(db.raw.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE user = ?`).get(user) as { n: number }).n;

interface Opts {
	method?: string;
	body?: unknown;
	/** null: sin JWT. */
	email?: string | null;
	service?: boolean;
	origin?: string;
	type?: string;
}

async function call(db: ReturnType<typeof sqliteD1>, { method = 'DELETE', body, email = ANA, service, origin, type }: Opts = {}) {
	const headers: Record<string, string> = {};
	if (service) headers['cf-access-jwt-assertion'] = await k.sign({ common_name: 'svc.access' });
	else if (email) headers['cf-access-jwt-assertion'] = await k.sign({ email });
	if (origin) headers.origin = origin;
	if (body !== undefined) headers['content-type'] = type ?? 'application/json';
	const request = new Request('https://arcterminal.dev/api/account', {
		method,
		headers,
		body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body)
	});
	return handleAccount(request, ENV, d1AdminStore(db), k.certs);
}

const errorOf = async (res: Response) => ((await res.json()) as { error?: string }).error;

describe('DELETE /api/account', () => {
	it('borra todas las filas de quien lo pide, en cada tabla de USER_TABLES, y ninguna de otro', async () => {
		const db = sqliteD1();
		await seed(db);
		const res = await call(db, { body: { confirm: ANA } });
		expect(res.status).toBe(200);
		for (const t of USER_TABLES) {
			expect(left(db, t, ANA), t).toBe(0);
			expect(left(db, t, BOB), t).toBe(1);
		}
	});

	it('el email sale del JWT: aunque confirme el de otro, no borra nada de nadie', async () => {
		const db = sqliteD1();
		await seed(db);
		const res = await call(db, { body: { confirm: BOB } });
		expect(res.status).toBe(400);
		expect(await errorOf(res)).toBe('confirmación');
		for (const t of USER_TABLES) for (const u of [ANA, BOB]) expect(left(db, t, u), `${t} ${u}`).toBe(1);
	});

	it('sin confirmar, o sin JSON: no borra nada', async () => {
		const db = sqliteD1();
		await seed(db);
		for (const [opts, status] of [
			[{}, 415],
			[{ body: {} }, 400],
			[{ body: { confirm: '' } }, 400],
			[{ body: { confirm: 42 } }, 400],
			[{ body: '{malo', type: 'application/json' }, 400],
			[{ body: { confirm: ANA }, type: 'text/plain' }, 415]
		] as const)
			expect((await call(db, opts as Opts)).status, JSON.stringify(opts)).toBe(status);
		for (const t of USER_TABLES) expect(left(db, t, ANA), t).toBe(1);
	});

	it('la confirmación vale en mayúsculas o con espacios', async () => {
		const db = sqliteD1();
		await seed(db);
		expect((await call(db, { body: { confirm: '  Ana@X.es ' } })).status).toBe(200);
		expect(left(db, 'prefs', ANA)).toBe(0);
	});

	it('sin identidad: 401, sin tocar la base', async () => {
		const db = sqliteD1();
		const res = await call(db, { email: null, body: { confirm: ANA } });
		expect(res.status).toBe(401);
		expect(await errorOf(res)).toBe('sin identificar');
		expect(db.raw.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all()).toEqual([]);
	});

	it('desde otra web: 403 aunque el JWT sea bueno, y no borra nada', async () => {
		const db = sqliteD1();
		await seed(db);
		const res = await call(db, { origin: 'https://malo.example', body: { confirm: ANA } });
		expect(res.status).toBe(403);
		expect(await errorOf(res)).toBe('origen');
		for (const t of USER_TABLES) expect(left(db, t, ANA), t).toBe(1);
	});

	it('un token de servicio (la Action) no puede borrar cuentas: 403', async () => {
		const db = sqliteD1();
		const res = await call(db, { service: true, body: { confirm: ANA } });
		expect(res.status).toBe(403);
		expect(await errorOf(res)).toBe('solo personas');
	});

	it('solo DELETE: GET, POST o PUT, 405', async () => {
		const db = sqliteD1();
		for (const method of ['GET', 'POST', 'PUT'])
			expect((await call(db, { method, body: method === 'GET' ? undefined : { confirm: ANA } })).status, method).toBe(405);
	});

	it('sin base: 503 «sin configurar»', async () => {
		const request = new Request('https://arcterminal.dev/api/account', { method: 'DELETE' });
		const res = await handleAccount(request, ENV, null, k.certs);
		expect(res.status).toBe(503);
		expect(await errorOf(res)).toBe('sin configurar');
	});
});
