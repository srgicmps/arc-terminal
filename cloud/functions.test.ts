// Las Pages Functions de functions/api/ de punta a punta, como las llama Cloudflare (onRequest con request y env):
// el envoltorio (de env.DB al store, y el .catch que convierte cualquier fallo en 503), la lógica de cloud/ y una
// D1 de verdad sobre SQLite (d1sqlite.ts), con JWT de Access firmados con las claves de prueba (testkeys.ts).
// Las claves públicas se sirven con un fetch de mentira: los envoltorios usan el fetch global.
// Así, un envoltorio mal conectado o que deje escapar un error (un 500) se ve aquí y no en producción.
import { readFileSync } from 'node:fs';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { withoutAi } from '../scripts/cf-config.ts';
import { clearKeyCache } from './access.ts';
import { sqliteD1 } from './d1sqlite.ts';
import type { D1Database } from './prefs.ts';
import { resetSchema } from './schema.ts';
import { ENV, testKeys } from './testkeys.ts';

type OnRequest = (context: { request: Request; env: Record<string, unknown> }) => Promise<Response>;
const modules = import.meta.glob<{ onRequest?: OnRequest }>('../functions/api/*.ts', { eager: true });
/** «prefs» → el módulo de functions/api/prefs.ts. */
const FUNCTIONS = Object.fromEntries(
	Object.entries(modules).map(([path, m]) => [path.replace(/^.*\/(.*)\.ts$/, '$1'), m])
);

/** El administrador de las pruebas (Secret ADMIN_EMAIL). */
const ADMIN = 'ana@x.es';

interface Call {
	method?: string;
	body?: unknown;
	query?: string;
	/** Como la Action (token de servicio) en lugar de como persona. */
	service?: boolean;
}

/**
 * Lo que debe salir bien en cada una: como persona (el admin, para que admin y la lista de feedback respondan),
 * salvo brief, que es solo de la Action. Una Function nueva tiene que añadir aquí su caso.
 */
const OK: Record<string, Call> = {
	admin: {},
	alerts: {},
	ask: {},
	brief: {
		method: 'POST',
		body: { mails: [{ uid: 'a'.repeat(16), subject: 'Tu mañana', text: 'Hola' }] },
		service: true
	},
	errors: {},
	family: {},
	feedback: {},
	forecasts: {},
	prefs: {},
	rss: {}
};
const NAMES = Object.keys(OK);

let k: Awaited<ReturnType<typeof testKeys>>;
beforeAll(async () => void (k = await testKeys()));
beforeEach(() => {
	clearKeyCache();
	resetSchema();
	// Solo responde a las claves de Access: cualquier otra salida (ntfy, Brevo…) lanza un error.
	vi.stubGlobal('fetch', vi.fn(k.certs));
});

/** El env de Pages, completo: Access, la base, Workers AI y los archivos de la web (ask) y los Secrets que miran admin, feedback y brief. */
const fullEnv = (db: D1Database) => ({
	...ENV,
	DB: db,
	AI: { run: async () => ({ response: 'No lo sé con los datos de hoy.' }) },
	ASSETS: { fetch: async () => new Response('', { status: 404 }) },
	ADMIN_EMAIL: ADMIN,
	BREVO_API_KEY: 'clave-de-prueba',
	BREVO_SENDER: 'arc@x.es'
});

async function call(
	name: string,
	env: Record<string, unknown>,
	{ method = 'GET', body, query = '', service = false }: Call = {},
	extra: { token?: string | null; origin?: string; email?: string } = {}
): Promise<Response> {
	const token =
		extra.token === undefined
			? await k.sign(service ? { common_name: 'svc.access' } : { email: extra.email ?? ADMIN })
			: extra.token;
	const headers: Record<string, string> = {};
	if (token) headers['cf-access-jwt-assertion'] = token;
	if (extra.origin) headers.origin = extra.origin;
	if (body !== undefined) headers['content-type'] = 'application/json';
	const request = new Request(`https://arcterminal.dev/api/${name}${query}`, {
		method,
		headers,
		body: body === undefined ? undefined : JSON.stringify(body)
	});
	return FUNCTIONS[name].onRequest!({ request, env });
}

const errorOf = async (res: Response) => ((await res.json()) as { error?: string }).error;
const tables = (db: ReturnType<typeof sqliteD1>) =>
	db.raw.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all();

describe('functions/api', () => {
	it('cada Function exporta onRequest y tiene su caso en este test', () => {
		expect(Object.keys(FUNCTIONS).sort()).toEqual([...NAMES].sort());
		for (const name of NAMES) expect(typeof FUNCTIONS[name].onRequest, name).toBe('function');
	});

	it('sin configurar (sin Access o sin base): 503 «sin configurar», nunca un error', async () => {
		for (const name of NAMES)
			for (const env of [{}, { ...ENV }, { DB: sqliteD1() }])
				for (const method of ['GET', 'POST', 'PUT', 'DELETE']) {
					const res = await call(name, env, { method, body: method === 'GET' ? undefined : {} });
					expect(res.status, `${method} ${name}`).toBe(503);
					expect(await errorOf(res), name).toBe('sin configurar');
				}
	});

	it('sin JWT: 401 «sin identificar», sin tocar la base', async () => {
		for (const name of NAMES) {
			const db = sqliteD1();
			const res = await call(name, fullEnv(db), OK[name], { token: null });
			expect(res.status, name).toBe(401);
			expect(await errorOf(res), name).toBe('sin identificar');
			expect(tables(db), name).toEqual([]);
		}
	});

	it('desde otra web: 403 aunque el JWT sea bueno, sin tocar la base', async () => {
		for (const name of NAMES) {
			const db = sqliteD1();
			// Como persona: brief, que no mira el origen (solo lo llama la Action), la rechaza igual.
			const res = await call(name, fullEnv(db), { ...OK[name], service: false }, { origin: 'https://malo.example' });
			expect(res.status, name).toBe(403);
			expect(await errorOf(res), name).toBe(name === 'brief' ? 'solo la Action' : 'origen');
			expect(tables(db), name).toEqual([]);
		}
	});

	it('con un JWT bueno y la base: 200', async () => {
		for (const name of NAMES) {
			// Una base nueva para cada una: que sus tablas se creen en ella.
			resetSchema();
			const res = await call(name, fullEnv(sqliteD1()), OK[name]);
			expect(res.status, `${name}: ${await res.clone().text()}`).toBe(200);
		}
	});

	it('si la base falla: 503 «no disponible» (el .catch del envoltorio), nunca un 500', async () => {
		const broken: D1Database = {
			prepare: () => {
				throw new Error('D1 caída');
			},
			exec: async () => {
				throw new Error('D1 caída');
			},
			batch: async () => {
				throw new Error('D1 caída');
			}
		};
		for (const name of NAMES) {
			const res = await call(name, fullEnv(broken), OK[name]);
			expect(res.status, name).toBe(503);
			expect(await errorOf(res), name).toBe('no disponible');
		}
	});

	it('toda respuesta es JSON, sin caché y con nosniff: 503, 401, 403 y 200', async () => {
		for (const name of NAMES) {
			resetSchema();
			const db = sqliteD1();
			for (const res of [
				await call(name, {}, OK[name]),
				await call(name, fullEnv(db), OK[name], { token: null }),
				await call(name, fullEnv(db), { ...OK[name], service: false }, { origin: 'https://malo.example' }),
				await call(name, fullEnv(db), OK[name])
			]) {
				expect(res.headers.get('content-type'), name).toBe('application/json');
				expect(res.headers.get('cache-control'), name).toBe('no-store');
				expect(res.headers.get('x-content-type-options'), name).toBe('nosniff');
			}
		}
	});

	it('/api/prefs: guarda, devuelve solo lo de cada uno y apunta el último acceso', async () => {
		const db = sqliteD1();
		const env = fullEnv(db);
		const put = await call('prefs', env, { method: 'PUT', body: { set: { 'arc-accent': 'cyan' } } });
		expect(put.status).toBe(200);
		expect(await (await call('prefs', env)).json()).toEqual({ user: ADMIN, prefs: { 'arc-accent': 'cyan' } });
		expect(await (await call('prefs', env, {}, { email: 'Bob@X.es' })).json()).toEqual({ user: 'bob@x.es', prefs: {} });
		const seen = db.raw.prepare('SELECT user FROM seen ORDER BY user').all();
		expect(seen).toEqual([{ user: ADMIN }, { user: 'bob@x.es' }]);
	});
});

describe('wrangler.toml', () => {
	// scripts/cf-config.ts rellena los valores al publicar; los nombres tienen que ser los que leen las Functions.
	const toml = readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8');

	it('la base se llama DB (env.DB) y están las variables de Access', () => {
		expect(toml).toMatch(/^binding = "DB"$/m);
		expect(toml).toMatch(/^ACCESS_TEAM_DOMAIN = /m);
		expect(toml).toMatch(/^ACCESS_AUD = /m);
	});

	it('Workers AI se llama AI (env.AI) y cf-config.ts sabe quitarlo sin tocar lo demás', () => {
		expect(toml).toMatch(/^\[ai\]\nbinding = "AI"$/m);
		const off = withoutAi(toml);
		expect(off).not.toMatch(/^\[ai\]/m);
		expect(off).toMatch(/^binding = "DB"$/m);
		expect(off).toMatch(/^ACCESS_AUD = /m);
	});
});
