import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { clearKeyCache } from './access.ts';
import { sqliteD1 } from './d1sqlite.ts';
import { d1ErrorStore, ERROR_LIMITS, handleErrors, memoryErrorStore, shortUa, type ErrorStore } from './errors.ts';
import { resetSchema } from './schema.ts';
import { ENV, testKeys } from './testkeys.ts';

let k: Awaited<ReturnType<typeof testKeys>>;
beforeAll(async () => void (k = await testKeys()));
beforeEach(() => {
	clearKeyCache();
	resetSchema();
});

const ADMIN = { ...ENV, ADMIN_EMAIL: 'Jefe@X.es' };
const IPHONE =
	'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const ORIGIN = 'https://arcterminal.dev';

/** Un error tal y como lo manda src/hooks.client.ts. */
const report = (msg = 'TypeError: x is not a function', hash = 'DwOWLKJQ') => ({
	msg,
	stack: `at Xe (${ORIGIN}/_app/immutable/nodes/12.${hash}.js:3:15)`,
	path: '/geo',
	ver: '1760968000000',
	style: 'grafito',
	modo: 'terminal',
	embed: false
});

function setup(store: ErrorStore = memoryErrorStore()) {
	const call = async (
		who: Record<string, unknown> | null,
		method = 'GET',
		body?: unknown,
		{ query = '', headers = {}, now }: { query?: string; headers?: Record<string, string>; now?: number } = {}
	) =>
		handleErrors(
			new Request(`${ORIGIN}/api/errors${query}`, {
				method,
				headers: {
					...(who ? { 'cf-access-jwt-assertion': await k.sign(who) } : {}),
					...(body !== undefined ? { 'content-type': 'application/json' } : {}),
					'user-agent': IPHONE,
					...headers
				},
				body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body)
			}),
			ADMIN,
			store,
			k.certs,
			now
		);
	return { store, call };
}

const ANA = { email: 'ana@x.es' };

describe('/api/errors', () => {
	it('sin JWT, 401; desde otra web, 403; un token de servicio (la Action), 403', async () => {
		const { call } = setup();
		expect((await call(null, 'POST', report())).status).toBe(401);
		expect((await call(ANA, 'POST', report(), { headers: { origin: 'https://malo.example' } })).status).toBe(403);
		expect((await call({ common_name: 'svc.access' }, 'POST', report())).status).toBe(403);
	});

	it('415 si no es JSON y 413 si pasa de 4 KB', async () => {
		const { call, store } = setup();
		expect((await call(ANA, 'POST', 'hola', { headers: { 'content-type': 'text/plain' } })).status).toBe(415);
		const big = { ...report(), stack: 'x'.repeat(ERROR_LIMITS.body) };
		expect((await call(ANA, 'POST', big)).status).toBe(413);
		expect(await store.list(10)).toEqual([]);
	});

	it('guarda el error limpio y sin quién: ni email ni uid; la ruta sin consulta y el navegador genérico', async () => {
		const { call, store } = setup();
		const res = await call(ANA, 'POST', { ...report(), path: '/s?q=NVDA', msg: 'Error: no carga para ana@x.es' });
		expect(res.status).toBe(200);
		const [row] = await store.list(10);
		expect(row).toMatchObject({
			path: '/s',
			ua: 'Safari · iOS',
			style: 'grafito',
			modo: 'terminal',
			n: 1,
			embed: false
		});
		expect(row.sig).toMatch(/^[0-9a-f]{8}$/);
		expect(JSON.stringify(row)).not.toMatch(/ana|@x\.es/);
	});

	it('el mismo error (aunque sea de otra build) suma 1 a su firma y pone al día ruta, versión y última vez', async () => {
		const { call, store } = setup();
		await call(ANA, 'POST', report(), { now: 1000 });
		await call(
			{ email: 'luis@x.es' },
			'POST',
			{ ...report('TypeError: x is not a function', 'Bq7_x-Z1'), path: '/eco', ver: '2' },
			{ now: 2000 }
		);
		const rows = await store.list(10);
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({ n: 2, first: 1000, last: 2000, path: '/eco', ver: '2' });
	});

	it('el ruido (Script error. sin pila, extensiones) no se guarda', async () => {
		const { call, store } = setup();
		expect((await call(ANA, 'POST', { msg: 'Script error.', stack: '' })).status).toBe(200);
		expect(
			(await call(ANA, 'POST', { msg: 'TypeError: x', stack: 'at f (chrome-extension://abc/a.js:1:2)' })).status
		).toBe(200);
		expect(await store.list(10)).toEqual([]);
	});

	it('como mucho 50 firmas nuevas al día; las conocidas siguen sumando', async () => {
		const { call, store } = setup();
		for (let i = 0; i < ERROR_LIMITS.newPerDay; i++)
			await call(ANA, 'POST', report(`Error: n${i}`), { now: 10_000 + i });
		expect((await call(ANA, 'POST', report('Error: una más'), { now: 20_000 })).status).toBe(429);
		expect((await call(ANA, 'POST', report('Error: n0'), { now: 20_000 })).status).toBe(200);
		expect((await store.list(100)).find((r) => r.msg === 'Error: n0')?.n).toBe(2);
		// Al día siguiente, otra vez.
		expect((await call(ANA, 'POST', report('Error: una más'), { now: 20_000 + 86_400_000 })).status).toBe(200);
	});

	it('solo el administrador lee y borra; nadie más, ni la Action', async () => {
		const { call, store } = setup();
		await call(ANA, 'POST', report());
		for (const who of [ANA, { email: 'luis@x.es' }, { common_name: 'svc.access' }]) {
			expect((await call(who)).status).toBe(403);
			expect((await call(who, 'DELETE', undefined, { query: '?sig=00000000' })).status).toBe(403);
		}
		const res = await call({ email: 'jefe@x.es' });
		expect(res.status).toBe(200);
		const { items } = (await res.json()) as { items: { sig: string }[] };
		expect(items).toHaveLength(1);
		expect((await call({ email: 'jefe@x.es' }, 'DELETE', undefined, { query: '?sig=nada' })).status).toBe(400);
		expect((await call({ email: 'jefe@x.es' }, 'DELETE', undefined, { query: `?sig=${items[0].sig}` })).status).toBe(
			200
		);
		expect(await store.list(10)).toEqual([]);
	});
});

describe('d1ErrorStore (SQLite de verdad)', () => {
	it('suma por firma, guarda los campos y poda a las 300 más recientes', async () => {
		const db = sqliteD1();
		const { call, store } = setup(d1ErrorStore(db));
		await call(ANA, 'POST', { ...report(), embed: true }, { now: 1 });
		await call(ANA, 'POST', report(), { now: 2 });
		const [row] = await store.list(10);
		expect(row).toMatchObject({ n: 2, first: 1, last: 2, embed: false, path: '/geo', ua: 'Safari · iOS' });

		// 300 filas como tope: entran más (otros días) y se van las que llevan más tiempo sin repetirse.
		const s = d1ErrorStore(db);
		for (let i = 0; i < ERROR_LIMITS.rows + 5; i++)
			await s.add(
				{ ...row, sig: (0x10000000 + i).toString(16), first: 100 + i, last: 100 + i, n: 1 },
				ERROR_LIMITS.rows
			);
		const count = (db.raw.prepare('SELECT COUNT(*) AS n FROM errors').get() as { n: number }).n;
		expect(count).toBe(ERROR_LIMITS.rows);
		expect((await s.list(1))[0].last).toBe(100 + ERROR_LIMITS.rows + 4);
		expect(await s.countNew(100 + ERROR_LIMITS.rows)).toBe(5);
		// La primera, que no se ha repetido desde entonces, ya no está.
		expect(db.raw.prepare('SELECT sig FROM errors WHERE sig = ?').get(row.sig)).toBeUndefined();
	});

	it('la tabla no tiene columna de usuario', async () => {
		const db = sqliteD1();
		await setup(d1ErrorStore(db)).call(ANA, 'POST', report());
		const cols = (db.raw.prepare('PRAGMA table_info(errors)').all() as { name: string }[]).map((c) => c.name);
		expect(cols).not.toContain('user');
		expect(cols).not.toContain('uid');
		expect(cols).not.toContain('email');
	});
});

describe('shortUa', () => {
	it('navegador y sistema, sin versiones', () => {
		expect(shortUa(IPHONE)).toBe('Safari · iOS');
		expect(
			shortUa(
				'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36'
			)
		).toBe('Chrome · Android');
		expect(shortUa('Mozilla/5.0 (Macintosh; Intel Mac OS X 14.6; rv:131.0) Gecko/20100101 Firefox/131.0')).toBe(
			'Firefox · macOS'
		);
		expect(
			shortUa(
				'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0'
			)
		).toBe('Edge · Windows');
		expect(shortUa('')).toBe('otro · otro');
	});
});
