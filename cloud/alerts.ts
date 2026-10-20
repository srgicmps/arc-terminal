// La API de los avisos al móvil de cada usuario: /api/alerts (la vista AVISOS y la Action de los avisos).
// - Una persona (JWT de Access con email): GET su configuración y su tema de ntfy; PUT para guardarla (al
//   activar los avisos se le crea un tema aleatorio y largo; con «rotate», uno nuevo); DELETE para borrarlo todo.
// - La Action (token de servicio de Access, sin email): GET ?all=1, la lista de los que tienen los avisos
//   activados, cada uno con un id aleatorio (uid), su tema y su configuración. Nunca el email. El del
//   administrador (Secret ADMIN_EMAIL) sale siempre, marcado `admin`, aunque no los tenga activados: sus alertas
//   y palabras salen por el tema de Sergi (NTFY_TOPIC). POST ?fired=1 { fired: [{ uid, ids }] }: borra las
//   alertas de precio que ya han avisado. POST ?migrate=1 { prices, mis, words }: las órdenes que había en
//   issues de GitHub pasan a la cuenta del administrador (una vez; luego los issues se cierran).
// El tema es la única protección del canal: solo sale de aquí hacia su dueño y hacia la Action.
import { parseConfig, parsePrices, parseWordList, type AlertConfig } from '../src/lib/alertconfig.ts';
import { tokenOf, verifyIdentity, type AccessConfig } from './access.ts';
import type { AdminEnv } from './feedback.ts';
import { json, type D1Database } from './prefs.ts';
import { ensure } from './schema.ts';

export interface AlertRow {
	/** Id aleatorio: con él la Action guarda el historial de cada uno sin saber quién es. */
	uid: string;
	topic: string | null;
	config: AlertConfig;
	/** Solo en la lista de la Action: es la cuenta del administrador. */
	admin?: boolean;
}

export interface AlertStore {
	get(user: string): Promise<AlertRow | null>;
	put(user: string, row: AlertRow): Promise<void>;
	remove(user: string): Promise<void>;
	all(): Promise<AlertRow[]>;
	/** El email de un uid (solo para buscar su fila aquí dentro). */
	userOf(uid: string): Promise<string | null>;
}

const hex = (bytes: number) =>
	[...crypto.getRandomValues(new Uint8Array(bytes))].map((b) => b.toString(16).padStart(2, '0')).join('');

/** Un tema de ntfy imposible de adivinar: 128 bits aleatorios. */
export const newTopic = () => `arc-${hex(16)}`;

export async function handleAlerts(
	request: Request,
	env: AdminEnv,
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

	// La Action: leer la lista, borrar alertas que ya han avisado y la migración de los issues. Nada más.
	const params = new URL(request.url).searchParams;
	if (who.service !== undefined) {
		const adminEmail = env.ADMIN_EMAIL?.trim().toLowerCase();
		const admin = adminEmail ? await store.get(adminEmail) : null;
		if (request.method === 'GET' && all) {
			const users = (await store.all())
				.filter((r) => (r.config.on && r.topic) || r.uid === admin?.uid)
				.map((r) => (r.uid === admin?.uid ? { ...r, admin: true } : r));
			return json(200, { users });
		}
		if (request.method !== 'POST') return json(403, { error: 'solo lectura' });
		const body = await readBody(request);
		if (body instanceof Response) return body;
		if (params.get('fired') === '1') {
			const fired = Array.isArray(body.fired) ? body.fired.slice(0, 500) : [];
			let removed = 0;
			for (const f of fired as { uid?: unknown; ids?: unknown }[]) {
				const user = typeof f?.uid === 'string' ? await store.userOf(f.uid) : null;
				const row = user ? await store.get(user) : null;
				if (!user || !row || !Array.isArray(f.ids)) continue;
				const prices = row.config.prices.filter((p) => !(f.ids as unknown[]).includes(p.id));
				if (prices.length === row.config.prices.length) continue;
				removed += row.config.prices.length - prices.length;
				await store.put(user, { ...row, config: { ...row.config, prices } });
			}
			return json(200, { removed });
		}
		if (params.get('migrate') === '1') {
			if (!adminEmail) return json(409, { error: 'sin ADMIN_EMAIL' });
			const row = admin ?? { uid: hex(8), topic: null, config: parseConfig({}) };
			const c = row.config;
			const prices = parsePrices([...c.prices, ...(Array.isArray(body.prices) ? body.prices : [])]);
			const words = parseWordList([...c.words, ...(Array.isArray(body.words) ? body.words : [])]);
			const mis = parseConfig({ mis: [...c.mis, ...(Array.isArray(body.mis) ? body.mis : [])] }).mis;
			await store.put(adminEmail, { uid: row.uid, topic: row.topic, config: { ...c, prices, words, mis } });
			return json(200, { prices: prices.length, words: words.length, mis: mis.length });
		}
		return json(403, { error: 'no' });
	}
	if (all) return json(403, { error: 'no' });
	const user = who.email;

	if (request.method === 'GET') {
		const row = await store.get(user);
		return json(200, { config: row?.config ?? parseConfig({}), topic: row?.topic ?? null });
	}

	if (request.method === 'PUT') {
		const body = await readBody(request);
		if (body instanceof Response) return body;
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

/** El cuerpo JSON (un objeto), o la respuesta de error. */
async function readBody(request: Request): Promise<Record<string, unknown> | Response> {
	if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json')
		return json(415, { error: 'solo JSON' });
	const text = await request.text();
	if (text.length > 16_000) return json(413, { error: 'demasiado grande' });
	try {
		const v: unknown = JSON.parse(text);
		if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
	} catch {
		// Abajo.
	}
	return json(400, { error: 'JSON no válido' });
}

/** D1: tabla alerts, una fila por persona. Se crea sola la primera vez (cloud/schema.ts). */
export function d1AlertStore(db: D1Database): AlertStore {
	const ready = () => ensure(db, 'alerts');
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
		},
		async userOf(uid) {
			await ready();
			const { results } = await db.prepare('SELECT user FROM alerts WHERE uid = ?').bind(uid).all<{ user: string }>();
			return results[0]?.user ?? null;
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
		all: async () => [...rows.values()].map((r) => structuredClone(r)),
		userOf: async (uid) => [...rows].find(([, r]) => r.uid === uid)?.[0] ?? null
	};
}
