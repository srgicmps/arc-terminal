// La API de los ajustes de cada usuario: GET /api/prefs y PUT /api/prefs. La usa src/lib/cloud.ts.
// Cada fila es (email, clave, valor): un usuario solo ve y cambia las suyas, porque el email sale del JWT
// de Access verificado (access.ts), nunca de lo que mande el navegador. Las claves válidas son las mismas
// que se pueden llevar a otro dispositivo (portable, de src/lib/transfer.ts, que sale de prefs.ts).
import { portable } from '../src/lib/transfer.ts';
import { tokenOf, verifyAccess, type AccessConfig } from './access.ts';

/** Topes: de sobra para lo que se guarda hoy (lo más grande, la partida de ajedrez, no llega a 5 KB). */
export const LIMITS = { keys: 200, value: 64 * 1024, total: 512 * 1024, body: 600 * 1024 };

/** Dónde se guarda. En Cloudflare, D1 (d1Store); en los tests, memoryStore. */
export interface Store {
	all(user: string): Promise<Record<string, string>>;
	/** Aplica de una vez: pone las de `set` y borra las de `del`. */
	patch(user: string, set: Record<string, string>, del: string[]): Promise<void>;
}

export interface Env {
	DB?: D1Database;
	ACCESS_TEAM_DOMAIN?: string;
	ACCESS_AUD?: string;
}

const json = (status: number, body: unknown) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
	});

const size = (prefs: Record<string, string>) => Object.entries(prefs).reduce((n, [k, v]) => n + k.length + v.length, 0);

/** El cuerpo de un PUT, comprobado: { set: {clave: valor}, del: [clave] }. Un texto con el error si no vale. */
export function parsePatch(body: unknown): { set: Record<string, string>; del: string[] } | string {
	if (!body || typeof body !== 'object' || Array.isArray(body)) return 'cuerpo no válido';
	const { set = {}, del = [] } = body as { set?: unknown; del?: unknown };
	if (!set || typeof set !== 'object' || Array.isArray(set) || !Array.isArray(del)) return 'cuerpo no válido';
	const entries = Object.entries(set);
	if (entries.length + del.length > LIMITS.keys) return 'demasiadas claves';
	for (const [k, v] of entries) {
		if (!portable(k) || k.length > 100) return `clave no válida: ${k.slice(0, 100)}`;
		if (typeof v !== 'string' || v.length > LIMITS.value) return `valor no válido: ${k}`;
	}
	for (const k of del) if (typeof k !== 'string' || !portable(k)) return 'clave no válida';
	return { set: set as Record<string, string>, del: del as string[] };
}

export async function handlePrefs(
	request: Request,
	env: Env,
	store: Store | null,
	fetcher?: (url: string) => Promise<Response>
): Promise<Response> {
	if (!store || !env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) return json(503, { error: 'sin configurar' });

	// Contra CSRF: si el navegador dice de dónde viene, tiene que ser de esta misma web.
	const origin = request.headers.get('origin');
	if (origin && origin !== new URL(request.url).origin) return json(403, { error: 'origen' });

	const token = tokenOf(request);
	const config: AccessConfig = { teamDomain: env.ACCESS_TEAM_DOMAIN, aud: env.ACCESS_AUD };
	const user = token ? await verifyAccess(token, config, fetcher).catch(() => null) : null;
	if (!user) return json(401, { error: 'sin identificar' });

	if (request.method === 'GET') return json(200, { user, prefs: await store.all(user) });

	if (request.method === 'PUT') {
		if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json')
			return json(415, { error: 'solo JSON' });
		const text = await request.text();
		if (text.length > LIMITS.body) return json(413, { error: 'demasiado grande' });
		let body: unknown;
		try {
			body = JSON.parse(text);
		} catch {
			return json(400, { error: 'JSON no válido' });
		}
		const patch = parsePatch(body);
		if (typeof patch === 'string') return json(400, { error: patch });
		const next = { ...(await store.all(user)), ...patch.set };
		for (const k of patch.del) delete next[k];
		if (Object.keys(next).length > LIMITS.keys || size(next) > LIMITS.total)
			return json(413, { error: 'demasiado grande' });
		await store.patch(user, patch.set, patch.del);
		return json(200, { ok: true });
	}

	return json(405, { error: 'método' });
}

/** Lo mínimo de D1 que usamos (así no hace falta instalar los tipos de Cloudflare). */
export interface D1Database {
	prepare(sql: string): D1Statement;
	batch(statements: D1Statement[]): Promise<unknown>;
	exec(sql: string): Promise<unknown>;
}
interface D1Statement {
	bind(...values: unknown[]): D1Statement;
	all<T>(): Promise<{ results: T[] }>;
}

let tableReady = false;

/** D1: una tabla, (email, clave) única. La tabla se crea sola la primera vez. */
export function d1Store(db: D1Database): Store {
	const ready = async () => {
		if (tableReady) return;
		await db.exec(
			'CREATE TABLE IF NOT EXISTS prefs (user TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, updated INTEGER NOT NULL, PRIMARY KEY (user, key))'
		);
		tableReady = true;
	};
	return {
		async all(user) {
			await ready();
			const { results } = await db
				.prepare('SELECT key, value FROM prefs WHERE user = ?')
				.bind(user)
				.all<{ key: string; value: string }>();
			return Object.fromEntries(results.map((r) => [r.key, r.value]));
		},
		async patch(user, set, del) {
			await ready();
			const now = Date.now();
			const statements = [
				...Object.entries(set).map(([k, v]) =>
					db
						.prepare(
							'INSERT INTO prefs (user, key, value, updated) VALUES (?, ?, ?, ?) ON CONFLICT (user, key) DO UPDATE SET value = excluded.value, updated = excluded.updated'
						)
						.bind(user, k, v, now)
				),
				...del.map((k) => db.prepare('DELETE FROM prefs WHERE user = ? AND key = ?').bind(user, k))
			];
			if (statements.length) await db.batch(statements);
		}
	};
}

/** En memoria, para los tests. */
export function memoryStore(): Store & { rows: Map<string, Record<string, string>> } {
	const rows = new Map<string, Record<string, string>>();
	return {
		rows,
		async all(user) {
			return { ...(rows.get(user) ?? {}) };
		},
		async patch(user, set, del) {
			const mine = { ...(rows.get(user) ?? {}), ...set };
			for (const k of del) delete mine[k];
			rows.set(user, mine);
		}
	};
}
