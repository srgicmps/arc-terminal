// La API de los avisos al móvil de cada usuario: /api/alerts (la vista AVISOS y la Action de los avisos).
// - Una persona (JWT de Access con email): GET su configuración y su tema de ntfy; PUT para guardarla (al
//   activar los avisos se le crea un tema aleatorio y largo; con «rotate», uno nuevo); DELETE para borrarlo todo.
// - La Action (token de servicio de Access, sin email): GET ?all=1, la lista de los que tienen los avisos
//   activados, cada uno con un id aleatorio (uid), su tema y su configuración. Nunca el email.
// El tema es la única protección del canal: solo sale de aquí hacia su dueño y hacia la Action.
import { parseConfig, type AlertConfig } from '../src/lib/alertconfig.ts';
import { tokenOf, verifyIdentity, type AccessConfig } from './access.ts';
import { json, type D1Database, type Env } from './prefs.ts';

export interface AlertRow {
	/** Id aleatorio: con él la Action guarda el historial de cada uno sin saber quién es. */
	uid: string;
	topic: string | null;
	config: AlertConfig;
}

export interface AlertStore {
	get(user: string): Promise<AlertRow | null>;
	put(user: string, row: AlertRow): Promise<void>;
	remove(user: string): Promise<void>;
	all(): Promise<AlertRow[]>;
}

const hex = (bytes: number) =>
	[...crypto.getRandomValues(new Uint8Array(bytes))].map((b) => b.toString(16).padStart(2, '0')).join('');

/** Un tema de ntfy imposible de adivinar: 128 bits aleatorios. */
export const newTopic = () => `arc-${hex(16)}`;

export async function handleAlerts(
	request: Request,
	env: Env,
	store: AlertStore | null,
	fetcher?: (url: string) => Promise<Response>
): Promise<Response> {
	if (!store || !env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) return json(503, { error: 'sin configurar' });
	const origin = request.headers.get('origin');
	if (origin && origin !== new URL(request.url).origin) return json(403, { error: 'origen' });

	const token = tokenOf(request);
	const config: AccessConfig = { teamDomain: env.ACCESS_TEAM_DOMAIN, aud: env.ACCESS_AUD };
	const who = token ? await verifyIdentity(token, config, fetcher).catch(() => null) : null;
	if (!who) return json(401, { error: 'sin identificar' });
	const all = new URL(request.url).searchParams.get('all') === '1';

	// La Action: solo puede leer la lista; una persona no puede pedirla.
	if (who.service !== undefined) {
		if (request.method !== 'GET' || !all) return json(403, { error: 'solo lectura' });
		const users = (await store.all()).filter((r) => r.config.on && r.topic);
		return json(200, { users });
	}
	if (all) return json(403, { error: 'no' });
	const user = who.email;

	if (request.method === 'GET') {
		const row = await store.get(user);
		return json(200, { config: row?.config ?? parseConfig({}), topic: row?.topic ?? null });
	}

	if (request.method === 'PUT') {
		if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json')
			return json(415, { error: 'solo JSON' });
		const text = await request.text();
		if (text.length > 8_000) return json(413, { error: 'demasiado grande' });
		let body: { config?: unknown; rotate?: unknown };
		try {
			body = JSON.parse(text);
		} catch {
			return json(400, { error: 'JSON no válido' });
		}
		const next = parseConfig(body?.config);
		const row = (await store.get(user)) ?? { uid: hex(8), topic: null, config: next };
		const topic = next.on && (!row.topic || body?.rotate === true) ? newTopic() : row.topic;
		await store.put(user, { uid: row.uid, topic, config: next });
		return json(200, { config: next, topic });
	}

	if (request.method === 'DELETE') {
		await store.remove(user);
		return json(200, { ok: true });
	}

	return json(405, { error: 'método' });
}

let tableReady = false;

/** D1: tabla alerts, una fila por persona. Se crea sola la primera vez. */
export function d1AlertStore(db: D1Database): AlertStore {
	const ready = async () => {
		if (tableReady) return;
		await db.exec(
			'CREATE TABLE IF NOT EXISTS alerts (user TEXT PRIMARY KEY, uid TEXT NOT NULL, topic TEXT, config TEXT NOT NULL, updated INTEGER NOT NULL)'
		);
		tableReady = true;
	};
	type Raw = { uid: string; topic: string | null; config: string };
	const row = (r: Raw): AlertRow => ({ uid: r.uid, topic: r.topic, config: parseConfig(JSON.parse(r.config)) });
	return {
		async get(user) {
			await ready();
			const { results } = await db
				.prepare('SELECT uid, topic, config FROM alerts WHERE user = ?')
				.bind(user)
				.all<Raw>();
			return results[0] ? row(results[0]) : null;
		},
		async put(user, r) {
			await ready();
			await db
				.prepare(
					'INSERT INTO alerts (user, uid, topic, config, updated) VALUES (?, ?, ?, ?, ?) ON CONFLICT (user) DO UPDATE SET topic = excluded.topic, config = excluded.config, updated = excluded.updated'
				)
				.bind(user, r.uid, r.topic, JSON.stringify(r.config), Date.now())
				.run();
		},
		async remove(user) {
			await ready();
			await db.prepare('DELETE FROM alerts WHERE user = ?').bind(user).run();
		},
		async all() {
			await ready();
			const { results } = await db.prepare('SELECT uid, topic, config FROM alerts').all<Raw>();
			return results.map(row);
		}
	};
}

/** En memoria, para los tests. */
export function memoryAlertStore(): AlertStore & { rows: Map<string, AlertRow> } {
	const rows = new Map<string, AlertRow>();
	return {
		rows,
		get: async (user) => structuredClone(rows.get(user) ?? null),
		put: async (user, r) => void rows.set(user, structuredClone(r)),
		remove: async (user) => void rows.delete(user),
		all: async () => [...rows.values()].map((r) => structuredClone(r))
	};
}
