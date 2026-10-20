// «Sugerencias / algo va mal»: /api/feedback. La usa el botón del pie (src/lib/components/Feedback.svelte).
// - Una persona (JWT de Access con email) manda POST { view, text }: se guarda en D1 (quién, vista, texto,
//   fecha) y, si la web tiene el Secret NTFY_TOPIC, se avisa a Sergi por su ntfy (solo el nombre antes de la @).
// - GET: la lista, solo para el administrador (Secret ADMIN_EMAIL de Cloudflare Pages; nunca en el repo).
//   Cualquier otro, 403. Los tokens de servicio (las Actions), tampoco.
import { tokenOf, verifyIdentity, type AccessConfig } from './access.ts';
import { json, type D1Database, type Env } from './prefs.ts';
import { ensure } from './schema.ts';

export interface AdminEnv extends Env {
	/** Email del administrador (Sergi). Secret de Pages: sin él, nadie es administrador. */
	ADMIN_EMAIL?: string;
	/** Tema de ntfy de Sergi (el mismo que NTFY_TOPIC de GitHub). Secret de Pages: sin él, no se avisa. */
	NTFY_TOPIC?: string;
}

export interface Feedback {
	id: number;
	user: string;
	view: string;
	text: string;
	at: number;
}

export interface FeedbackStore {
	add(f: Omit<Feedback, 'id'>): Promise<void>;
	/** Cuántas ha mandado `user` desde `since` (contra los envíos en bucle). */
	countSince(user: string, since: number): Promise<number>;
	/** Las últimas, de la más nueva a la más vieja. */
	list(limit: number): Promise<Feedback[]>;
	remove(id: number): Promise<void>;
}

export const FEEDBACK_LIMITS = { text: 2000, view: 120, perDay: 20, list: 200 };

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

/** ¿Es el administrador? Compara en minúsculas; sin ADMIN_EMAIL, nadie. */
export const isAdmin = (email: string | undefined, env: AdminEnv) =>
	!!email && !!env.ADMIN_EMAIL?.trim() && email.toLowerCase() === env.ADMIN_EMAIL.trim().toLowerCase();

/**
 * Quién llama, con el JWT de Access verificado: { email } de una persona, o una Response (401/403/503) para
 * devolver tal cual. Comprueba también el origen (contra CSRF).
 */
export async function person(
	request: Request,
	env: Env,
	fetcher?: (url: string) => Promise<Response>
): Promise<{ email: string } | Response> {
	if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) return json(503, { error: 'sin configurar' });
	const origin = request.headers.get('origin');
	if (origin && origin !== new URL(request.url).origin) return json(403, { error: 'origen' });
	const token = tokenOf(request);
	const config: AccessConfig = { teamDomain: env.ACCESS_TEAM_DOMAIN, aud: env.ACCESS_AUD };
	const who = token ? await verifyIdentity(token, config, fetcher).catch(() => null) : null;
	if (!who) return json(401, { error: 'sin identificar' });
	if (!who.email) return json(403, { error: 'solo personas' });
	return { email: who.email };
}

/** Lee un cuerpo JSON pequeño; una Response de error si no vale. */
export async function readJson(request: Request, max: number): Promise<Record<string, unknown> | Response> {
	if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json')
		return json(415, { error: 'solo JSON' });
	const text = await request.text();
	if (text.length > max) return json(413, { error: 'demasiado grande' });
	try {
		const body: unknown = JSON.parse(text);
		return body && typeof body === 'object' && !Array.isArray(body)
			? (body as Record<string, unknown>)
			: json(400, { error: 'cuerpo no válido' });
	} catch {
		return json(400, { error: 'JSON no válido' });
	}
}

/** Un aviso a Sergi por su ntfy. Si falla, da igual: la sugerencia ya está guardada. */
export async function tellAdmin(env: AdminEnv, title: string, body: string, fetcher: Fetch = fetch) {
	const topic = env.NTFY_TOPIC?.trim();
	if (!topic) return;
	await fetcher(`https://ntfy.sh/${encodeURIComponent(topic)}`, {
		method: 'POST',
		// Las cabeceras solo admiten ASCII: el título va en RFC 2047, que ntfy entiende (como en scripts/notify.ts).
		headers: {
			title: /^[\x20-\x7e]*$/.test(title) ? title : `=?UTF-8?B?${b64(title)}?=`,
			tags: 'speech_balloon',
			'content-type': 'text/plain; charset=utf-8'
		},
		body,
		signal: AbortSignal.timeout(5000)
	}).catch(() => null);
}

const b64 = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s)));

const VIEW = /^\/[\w\-/.]*$/;

export async function handleFeedback(
	request: Request,
	env: AdminEnv,
	store: FeedbackStore | null,
	fetcher?: Fetch,
	now = Date.now()
): Promise<Response> {
	if (!store) return json(503, { error: 'sin configurar' });
	const who = await person(request, env, fetcher);
	if (who instanceof Response) return who;

	if (request.method === 'POST') {
		const body = await readJson(request, 8000);
		if (body instanceof Response) return body;
		const text = typeof body.text === 'string' ? body.text.trim() : '';
		const view = typeof body.view === 'string' && VIEW.test(body.view) ? body.view.slice(0, FEEDBACK_LIMITS.view) : '/';
		if (!text) return json(400, { error: 'vacío' });
		if (text.length > FEEDBACK_LIMITS.text) return json(413, { error: 'demasiado largo' });
		if ((await store.countSince(who.email, now - 86_400_000)) >= FEEDBACK_LIMITS.perDay)
			return json(429, { error: 'demasiadas por hoy' });
		await store.add({ user: who.email, view, text, at: now });
		const name = who.email.split('@')[0];
		await tellAdmin(env, `Sugerencia · ${view}`, `${name}: ${text}`, fetcher);
		return json(200, { ok: true });
	}

	// Leer o borrar: solo el administrador.
	if (!isAdmin(who.email, env)) return json(403, { error: 'solo el administrador' });
	if (request.method === 'GET') return json(200, { items: await store.list(FEEDBACK_LIMITS.list) });
	if (request.method === 'DELETE') {
		const id = Number(new URL(request.url).searchParams.get('id'));
		if (!Number.isInteger(id) || id < 1) return json(400, { error: 'id' });
		await store.remove(id);
		return json(200, { ok: true });
	}
	return json(405, { error: 'método' });
}

/** D1: tabla feedback. Se crea sola la primera vez (cloud/schema.ts). */
export function d1FeedbackStore(db: D1Database): FeedbackStore {
	const ready = () => ensure(db, 'feedback');
	return {
		async add(f) {
			await ready();
			await db
				.prepare('INSERT INTO feedback (user, view, text, at) VALUES (?, ?, ?, ?)')
				.bind(f.user, f.view, f.text, f.at)
				.run();
		},
		async countSince(user, since) {
			await ready();
			const { results } = await db
				.prepare('SELECT COUNT(*) AS n FROM feedback WHERE user = ? AND at >= ?')
				.bind(user, since)
				.all<{ n: number }>();
			return results[0]?.n ?? 0;
		},
		async list(limit) {
			await ready();
			const { results } = await db
				.prepare('SELECT id, user, view, text, at FROM feedback ORDER BY at DESC LIMIT ?')
				.bind(limit)
				.all<Feedback>();
			return results;
		},
		async remove(id) {
			await ready();
			await db.prepare('DELETE FROM feedback WHERE id = ?').bind(id).run();
		}
	};
}

/** En memoria, para los tests. */
export function memoryFeedbackStore(): FeedbackStore & { rows: Feedback[] } {
	const rows: Feedback[] = [];
	let next = 1;
	return {
		rows,
		add: async (f) => void rows.push({ ...f, id: next++ }),
		countSince: async (user, since) => rows.filter((r) => r.user === user && r.at >= since).length,
		list: async (limit) => [...rows].sort((a, b) => b.at - a.at).slice(0, limit),
		remove: async (id) => {
			const i = rows.findIndex((r) => r.id === id);
			if (i >= 0) rows.splice(i, 1);
		}
	};
}
