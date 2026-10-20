// Avisos en el navegador, sin instalar ntfy (Web Push): /api/push. Se SUMA a ntfy, no lo sustituye.
// - Una persona (JWT de Access con email, desde esta misma web): GET la clave pública y cuántos dispositivos
//   tiene; PUT { endpoint, keys } guarda la suscripción de este navegador; DELETE { endpoint } la quita;
//   POST ?test=1 { endpoint } le manda un aviso de prueba (solo a uno suyo).
// - La Action (token de servicio de Access): GET ?all=1, los uid que tienen algún navegador (sin endpoints);
//   POST ?send=1 { uid, title, body, url, level }: el aviso a todos los navegadores de ese uid. Solo cuentas.
// - Familia (cloud/family.ts) manda también por aquí, con deliver().
// Topes: 5 navegadores por persona (el más antiguo deja sitio al nuevo) y 1 KB por suscripción. Las que el
// servicio de push da por muertas (404/410) se borran solas.
// SECRETO: el endpoint es una URL-capacidad (quien la tenga puede mandar a ese navegador, si además tuviera la
// clave privada): solo vive en D1. Nunca sale en una respuesta, en un registro ni en la URL de una petición.
// Clave: Secret de Pages VAPID_PRIVATE_KEY (JWK, scripts/vapid.ts). Sin él, 503 y la fila de AVISOS no sale.
import { identity } from './access.ts';
import { readJson } from './feedback.ts';
import { json, type D1Database, type Env } from './prefs.ts';
import { ensure } from './schema.ts';
import { fromB64url, MAX_PLAINTEXT, parseVapid, pushRequest, URGENCY, type PushKeys, type Vapid } from './webpush.ts';

export interface PushEnv extends Env {
	VAPID_PRIVATE_KEY?: string;
}

export interface PushSub extends PushKeys {
	endpoint: string;
}

export interface PushStore {
	/** Las de una persona (su email), de la más antigua a la más nueva. */
	mine(user: string): Promise<PushSub[]>;
	/** Las de un uid de avisos (tabla alerts): lo que manda la Action. */
	byUid(uid: string): Promise<PushSub[]>;
	/** Guarda la suscripción (o la pasa a esta persona) y deja solo las `max` más nuevas. */
	put(user: string, sub: PushSub, now: number, max: number): Promise<void>;
	/** Quita una de esta persona. */
	remove(user: string, endpoint: string): Promise<void>;
	/** Quita una que el servicio de push da por muerta (404/410). */
	drop(endpoint: string): Promise<void>;
	/** Los uid de avisos con algún navegador. */
	uids(): Promise<string[]>;
}

export const PUSH_LIMITS = { perUser: 5, sub: 1024, endpoint: 900, title: 120, body: 1500, url: 1000, send: 8000 };

/**
 * Los servicios de push de los navegadores: Chrome, Android, Opera, Samsung y Brave (FCM), Firefox (Mozilla),
 * Safari e iPhone (Apple) y Edge (Windows). Solo se manda ahí: así nadie puede hacer que la Function haga
 * peticiones a otra web.
 */
const HOSTS = ['fcm.googleapis.com', 'android.googleapis.com', 'push.services.mozilla.com', 'push.apple.com', 'notify.windows.com'];
const UID = /^[0-9a-f]{16}$/;
const B64URL = /^[A-Za-z0-9_-]+={0,2}$/;

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

/** Una suscripción válida (lo que da PushSubscription.toJSON()), o el error. */
export function cleanSub(raw: unknown): PushSub | string {
	const { endpoint, keys } = (raw ?? {}) as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
	if (typeof endpoint !== 'string' || endpoint.length > PUSH_LIMITS.endpoint) return 'endpoint no válido';
	let url: URL;
	try {
		url = new URL(endpoint);
	} catch {
		return 'endpoint no válido';
	}
	const host = url.hostname;
	if (url.protocol !== 'https:' || url.username || url.password || url.port) return 'endpoint no válido';
	if (!HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) return 'servicio de push desconocido';
	const { p256dh, auth } = keys ?? {};
	if (typeof p256dh !== 'string' || typeof auth !== 'string' || !B64URL.test(p256dh) || !B64URL.test(auth))
		return 'claves no válidas';
	try {
		const pub = fromB64url(p256dh);
		if (pub.length !== 65 || pub[0] !== 4 || fromB64url(auth).length !== 16) return 'claves no válidas';
	} catch {
		return 'claves no válidas';
	}
	return { endpoint: url.href, p256dh, auth };
}

/** Lo que muestra el service worker (src/service-worker/push.ts): título, texto y la vista que abre al tocarlo. */
export interface PushMessage {
	title: string;
	body: string;
	/** Absoluta (http/https). */
	url: string;
	/** Avisos con la misma etiqueta se sustituyen en vez de amontonarse. */
	tag?: string;
}

const line = (s: unknown, max: number) => (typeof s === 'string' ? s.replace(/[\p{Cc}\p{Cf}]/gu, ' ').trim().slice(0, max) : '');

/** El mensaje limpio, o null si falta el título o el enlace no es http(s). */
export function cleanMessage(raw: Record<string, unknown>, origin: string): PushMessage | null {
	const title = line(raw.title, PUSH_LIMITS.title).replace(/\s+/g, ' ');
	// El texto conserva los saltos de línea («Tu mañana» va en cinco líneas).
	const body = typeof raw.body === 'string' ? raw.body.replace(/[^\P{Cc}\n]/gu, ' ').trim().slice(0, PUSH_LIMITS.body) : '';
	let url: string;
	try {
		const u = new URL(typeof raw.url === 'string' && raw.url ? raw.url : '/', origin);
		if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
		url = u.href.slice(0, PUSH_LIMITS.url);
	} catch {
		return null;
	}
	const tag = line(raw.tag, 64);
	return title ? { title, body, url, ...(tag ? { tag } : {}) } : null;
}

/** El mensaje en JSON, recortando el texto hasta que quepa en un registro cifrado (unos 4 KB). */
export function payloadOf(m: PushMessage): string {
	let body = m.body;
	for (;;) {
		const text = JSON.stringify({ ...m, body });
		if (new TextEncoder().encode(text).length <= MAX_PLAINTEXT || !body) return text;
		body = `${body.slice(0, Math.floor(body.length * 0.8))}…`;
	}
}

/** Lo que pasa en un envío: cuántos han llegado, cuántos estaban muertos y los códigos (solo cuentas). */
export interface Delivery {
	sent: number;
	gone: number;
	codes: Record<string, number>;
}

/**
 * Manda un aviso a varios navegadores a la vez. Los que dan 404 o 410 ya no existen (el usuario quitó el
 * permiso, desinstaló…) y se borran. Nunca lanza. `subject`: la dirección de la web (sub de VAPID).
 */
export async function deliver(
	subs: PushSub[],
	message: PushMessage,
	vapid: Vapid,
	store: PushStore,
	fetcher: Fetch,
	options: { subject: string; ttl: number; urgency: 'very-low' | 'low' | 'normal' | 'high'; now?: number }
): Promise<Delivery> {
	const out: Delivery = { sent: 0, gone: 0, codes: {} };
	const payload = payloadOf(message);
	const jwts = new Map<string, string>();
	await Promise.all(
		subs.map(async (s) => {
			let status = 0;
			try {
				const init = await pushRequest(s.endpoint, s, payload, vapid, options, jwts);
				const res = await fetcher(s.endpoint, { ...init, signal: AbortSignal.timeout(10_000) });
				await res.body?.cancel().catch(() => {});
				status = res.status;
			} catch {
				// Sin respuesta (0): se cuenta, pero no se borra.
			}
			out.codes[status] = (out.codes[status] ?? 0) + 1;
			if (status >= 200 && status < 300) out.sent++;
			if (status === 404 || status === 410) {
				out.gone++;
				await store.drop(s.endpoint).catch(() => {});
			}
		})
	);
	return out;
}

/** Cuánto guarda el servicio de push un aviso si el dispositivo está apagado. */
const TTL = 6 * 3600;

export async function handlePush(
	request: Request,
	env: PushEnv,
	store: PushStore | null,
	fetcher?: (url: string) => Promise<Response>,
	sender: Fetch = (u, i) => fetch(u, i),
	now = Date.now()
): Promise<Response> {
	if (!store) return json(503, { error: 'sin configurar' });
	// Sin configurar, desde otra web o sin identificar: fuera (access.ts). Aquí valen también los tokens de servicio.
	const who = await identity(request, env, fetcher);
	if (who instanceof Response) return who;
	const vapid = await parseVapid(env.VAPID_PRIVATE_KEY);
	if (!vapid) return json(503, { error: 'sin claves' });
	const params = new URL(request.url).searchParams;
	const subject = new URL(request.url).origin;

	// La Action: la lista de uid con navegadores y los envíos. Nada más.
	if (who.service !== undefined) {
		if (request.method === 'GET' && params.get('all') === '1') return json(200, { uids: await store.uids() });
		if (request.method !== 'POST' || params.get('send') !== '1') return json(403, { error: 'no' });
		const body = await readJson(request, PUSH_LIMITS.send);
		if (body instanceof Response) return body;
		const message = cleanMessage(body, subject);
		if (typeof body.uid !== 'string' || !UID.test(body.uid) || !message) return json(400, { error: 'aviso no válido' });
		const level = [1, 2, 3, 4].includes(body.level as number) ? (body.level as 1 | 2 | 3 | 4) : 3;
		const subs = await store.byUid(body.uid);
		const done = await deliver(subs, message, vapid, store, sender, { subject, ttl: TTL, urgency: URGENCY[level], now });
		return json(200, done);
	}
	if (params.has('all') || params.has('send')) return json(403, { error: 'no' });
	const user = who.email;
	const count = async () => (await store.mine(user)).length;

	if (request.method === 'GET') return json(200, { key: vapid.public, count: await count(), max: PUSH_LIMITS.perUser });

	const body = await readJson(request, PUSH_LIMITS.sub);
	if (body instanceof Response) return body;

	if (request.method === 'PUT') {
		const sub = cleanSub(body);
		if (typeof sub === 'string') return json(400, { error: sub });
		await store.put(user, sub, now, PUSH_LIMITS.perUser);
		return json(200, { ok: true, count: await count() });
	}

	// DELETE y la prueba: solo con un navegador suyo.
	const endpoint = typeof body.endpoint === 'string' ? body.endpoint : '';
	const own = (await store.mine(user)).find((s) => s.endpoint === endpoint);

	if (request.method === 'DELETE') {
		if (own) await store.remove(user, own.endpoint);
		return json(200, { ok: true, count: await count() });
	}

	if (request.method === 'POST' && params.get('test') === '1') {
		if (!own) return json(404, { error: 'este navegador no está' });
		const message = { title: 'Arc Terminal', body: 'Así te llegarán los avisos en este dispositivo.', url: `${subject}/avisos`, tag: 'prueba' };
		const done = await deliver([own], message, vapid, store, sender, { subject, ttl: 600, urgency: 'high', now });
		return json(done.sent ? 200 : 502, { sent: done.sent, gone: done.gone });
	}

	return json(405, { error: 'método' });
}

/** D1: tabla push_subs (una fila por navegador; se crea sola, cloud/schema.ts). El uid sale de alerts. */
export function d1PushStore(db: D1Database): PushStore {
	const ready = () => ensure(db, 'push_subs', 'alerts');
	return {
		async mine(user) {
			await ready();
			const { results } = await db
				.prepare('SELECT endpoint, p256dh, auth FROM push_subs WHERE user = ? ORDER BY created, endpoint')
				.bind(user)
				.all<PushSub>();
			return results;
		},
		async byUid(uid) {
			await ready();
			const { results } = await db
				.prepare('SELECT p.endpoint, p.p256dh, p.auth FROM push_subs p JOIN alerts a ON a.user = p.user WHERE a.uid = ?')
				.bind(uid)
				.all<PushSub>();
			return results;
		},
		async put(user, sub, now, max) {
			await ready();
			await db.batch([
				db
					.prepare(
						'INSERT INTO push_subs (endpoint, user, p256dh, auth, created) VALUES (?, ?, ?, ?, ?) ON CONFLICT (endpoint) DO UPDATE SET user = excluded.user, p256dh = excluded.p256dh, auth = excluded.auth, created = excluded.created'
					)
					.bind(sub.endpoint, user, sub.p256dh, sub.auth, now),
				db
					.prepare(
						'DELETE FROM push_subs WHERE user = ? AND endpoint NOT IN (SELECT endpoint FROM push_subs WHERE user = ? ORDER BY created DESC, endpoint DESC LIMIT ?)'
					)
					.bind(user, user, max)
			]);
		},
		async remove(user, endpoint) {
			await ready();
			await db.prepare('DELETE FROM push_subs WHERE user = ? AND endpoint = ?').bind(user, endpoint).run();
		},
		async drop(endpoint) {
			await ready();
			await db.prepare('DELETE FROM push_subs WHERE endpoint = ?').bind(endpoint).run();
		},
		async uids() {
			await ready();
			const { results } = await db
				.prepare('SELECT DISTINCT a.uid AS uid FROM push_subs p JOIN alerts a ON a.user = p.user ORDER BY a.uid')
				.all<{ uid: string }>();
			return results.map((r) => r.uid);
		}
	};
}

/** En memoria, para los tests. `uidOf`: el uid de avisos de cada email (lo que en D1 sale de alerts). */
export function memoryPushStore(uidOf: Record<string, string> = {}): PushStore & { rows: Map<string, PushSub & { user: string; created: number }> } {
	const rows = new Map<string, PushSub & { user: string; created: number }>();
	const plain = ({ endpoint, p256dh, auth }: PushSub) => ({ endpoint, p256dh, auth });
	const of = (user: string) => [...rows.values()].filter((r) => r.user === user).sort((a, b) => a.created - b.created);
	return {
		rows,
		mine: async (user) => of(user).map(plain),
		byUid: async (uid) => [...rows.values()].filter((r) => uidOf[r.user] === uid).map(plain),
		async put(user, sub, now, max) {
			rows.set(sub.endpoint, { ...sub, user, created: now });
			for (const old of of(user).slice(0, -max)) rows.delete(old.endpoint);
		},
		remove: async (user, endpoint) => void (rows.get(endpoint)?.user === user && rows.delete(endpoint)),
		drop: async (endpoint) => void rows.delete(endpoint),
		uids: async () => [...new Set([...rows.values()].flatMap((r) => (uidOf[r.user] ? [uidOf[r.user]] : [])))].sort()
	};
}
