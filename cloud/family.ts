// «Mandar a la familia» (F15): /api/family. Un titular de Arc, por ntfy, a otro usuario que lo acepte.
// - Cada persona (JWT de Access con email) elige un nombre para que la reconozcan y si acepta recibir.
//   Solo salen en la lista quienes aceptan Y tienen los avisos activados (su tema de ntfy, cloud/alerts.ts).
// - GET: su ajuste y la lista de a quién puede mandar (id aleatorio y nombre; nunca emails ni temas).
//   PUT { name, accept }: guardar. DELETE: borrarlo. POST { to, title, url }: mandar, con tope diario.
// - El tema de ntfy del otro nunca sale de aquí: la Function manda el aviso por él.
import type { AlertStore } from './alerts.ts';
import { tokenOf, verifyIdentity, type AccessConfig } from './access.ts';
import { json, type D1Database, type Env } from './prefs.ts';
import { ensure } from './schema.ts';

export const FAMILY_LIMITS = { name: 40, title: 300, url: 1000, body: 4000, perDay: 30 };

export interface Member {
	/** Id aleatorio: lo que ve el resto, en vez del email. */
	id: string;
	name: string;
	accept: boolean;
}

export interface FamilyStore {
	get(user: string): Promise<Member | null>;
	put(user: string, m: Member): Promise<void>;
	remove(user: string): Promise<void>;
	/** Los que aceptan, con su email (solo para buscar su tema aquí dentro). */
	accepting(): Promise<(Member & { user: string })[]>;
	/** Cuántos ha mandado `user` desde `since`, y apuntar uno. */
	sentSince(user: string, since: number): Promise<number>;
	logSent(user: string, at: number): Promise<void>;
}

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

const hex = (bytes: number) =>
	[...crypto.getRandomValues(new Uint8Array(bytes))].map((b) => b.toString(16).padStart(2, '0')).join('');

/** Nombre limpio: sin caracteres de control, en una línea y con tope. '' si no vale. */
export function cleanName(raw: unknown): string {
	if (typeof raw !== 'string') return '';
	return raw.replace(/[\p{Cc}\p{Cf}]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, FAMILY_LIMITS.name);
}

/** Solo enlaces http(s), absolutos y con tope. */
export function cleanUrl(raw: unknown): string | null {
	if (typeof raw !== 'string' || raw.length > FAMILY_LIMITS.url) return null;
	try {
		const u = new URL(raw);
		return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null;
	} catch {
		return null;
	}
}

const b64 = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s)));
/** Las cabeceras solo admiten ASCII: lo demás en RFC 2047, que ntfy entiende (como en scripts/notify.ts). */
const header = (s: string) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`);

/** El tema de ntfy de un usuario si tiene los avisos activados; si no, null. */
async function topicOf(alerts: AlertStore, user: string): Promise<string | null> {
	const row = await alerts.get(user);
	return row?.config.on && row.topic ? row.topic : null;
}

async function readJson(request: Request): Promise<Record<string, unknown> | Response> {
	if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json')
		return json(415, { error: 'solo JSON' });
	const text = await request.text();
	if (text.length > FAMILY_LIMITS.body) return json(413, { error: 'demasiado grande' });
	try {
		const v: unknown = JSON.parse(text);
		return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : json(400, { error: 'JSON no válido' });
	} catch {
		return json(400, { error: 'JSON no válido' });
	}
}

export async function handleFamily(
	request: Request,
	env: Env,
	store: FamilyStore | null,
	alerts: AlertStore | null,
	fetcher?: (url: string) => Promise<Response>,
	push: Fetch = (u, i) => fetch(u, i),
	now = Date.now()
): Promise<Response> {
	if (!store || !alerts || !env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) return json(503, { error: 'sin configurar' });
	const origin = request.headers.get('origin');
	if (origin && origin !== new URL(request.url).origin) return json(403, { error: 'origen' });

	const token = tokenOf(request);
	const config: AccessConfig = { teamDomain: env.ACCESS_TEAM_DOMAIN, aud: env.ACCESS_AUD };
	const who = token ? await verifyIdentity(token, config, fetcher).catch(() => null) : null;
	if (!who) return json(401, { error: 'sin identificar' });
	if (who.service !== undefined) return json(403, { error: 'solo personas' });
	const user = who.email;

	if (request.method === 'GET') {
		const me = await store.get(user);
		const others = (await store.accepting()).filter((m) => m.user !== user);
		const ok = await Promise.all(others.map(async (m) => ((await topicOf(alerts, m.user)) ? m : null)));
		const people = ok
			.filter((m) => m !== null)
			.map((m) => ({ id: m.id, name: m.name }))
			.sort((a, b) => a.name.localeCompare(b.name, 'es'));
		return json(200, {
			me: { name: me?.name ?? '', accept: me?.accept ?? false },
			// ¿Le pueden llegar? Hace falta tener los avisos activados (AVISOS).
			reachable: !!(await topicOf(alerts, user)),
			people
		});
	}

	if (request.method === 'PUT') {
		const body = await readJson(request);
		if (body instanceof Response) return body;
		const name = cleanName(body.name);
		const accept = body.accept === true;
		if (!name) return json(400, { error: 'falta el nombre' });
		const prev = await store.get(user);
		await store.put(user, { id: prev?.id ?? hex(8), name, accept });
		return json(200, { me: { name, accept } });
	}

	if (request.method === 'POST') {
		const body = await readJson(request);
		if (body instanceof Response) return body;
		const me = await store.get(user);
		if (!me?.name) return json(409, { error: 'elige antes tu nombre' });
		const title = typeof body.title === 'string' ? body.title.replace(/\s+/g, ' ').trim().slice(0, FAMILY_LIMITS.title) : '';
		const url = cleanUrl(body.url);
		if (!title || !url) return json(400, { error: 'titular o enlace no válido' });
		const to = (await store.accepting()).find((m) => m.id === body.to && m.user !== user);
		const topic = to ? await topicOf(alerts, to.user) : null;
		if (!to || !topic) return json(404, { error: 'no recibe' });
		if ((await store.sentSince(user, now - 86_400_000)) >= FAMILY_LIMITS.perDay)
			return json(429, { error: 'tope diario' });
		const res = await push(`https://ntfy.sh/${encodeURIComponent(topic)}`, {
			method: 'POST',
			headers: {
				title: header(`${me.name} te manda`),
				click: url,
				tags: 'house',
				'content-type': 'text/plain; charset=utf-8'
			},
			body: title,
			signal: AbortSignal.timeout(5000)
		}).catch(() => null);
		if (!res?.ok) return json(502, { error: 'ntfy no responde' });
		await store.logSent(user, now);
		return json(200, { ok: true, to: to.name });
	}

	if (request.method === 'DELETE') {
		await store.remove(user);
		return json(200, { ok: true });
	}

	return json(405, { error: 'método' });
}

/** D1: tabla family (una fila por persona) y family_sent (para el tope diario). Se crean solas (cloud/schema.ts). */
export function d1FamilyStore(db: D1Database): FamilyStore {
	const ready = () => ensure(db, 'family', 'family_sent');
	type Raw = { user: string; id: string; name: string; accept: number };
	const row = (r: Raw) => ({ user: r.user, id: r.id, name: r.name, accept: r.accept === 1 });
	return {
		async get(user) {
			await ready();
			const { results } = await db
				.prepare('SELECT user, id, name, accept FROM family WHERE user = ?')
				.bind(user)
				.all<Raw>();
			if (!results[0]) return null;
			const { id, name, accept } = row(results[0]);
			return { id, name, accept };
		},
		async put(user, m) {
			await ready();
			await db
				.prepare(
					'INSERT INTO family (user, id, name, accept, updated) VALUES (?, ?, ?, ?, ?) ON CONFLICT (user) DO UPDATE SET name = excluded.name, accept = excluded.accept, updated = excluded.updated'
				)
				.bind(user, m.id, m.name, m.accept ? 1 : 0, Date.now())
				.run();
		},
		async remove(user) {
			await ready();
			await db.prepare('DELETE FROM family WHERE user = ?').bind(user).run();
			await db.prepare('DELETE FROM family_sent WHERE user = ?').bind(user).run();
		},
		async accepting() {
			await ready();
			const { results } = await db.prepare('SELECT user, id, name, accept FROM family WHERE accept = 1').all<Raw>();
			return results.map(row);
		},
		async sentSince(user, since) {
			await ready();
			const { results } = await db
				.prepare('SELECT COUNT(*) AS n FROM family_sent WHERE user = ? AND at >= ?')
				.bind(user, since)
				.all<{ n: number }>();
			return results[0]?.n ?? 0;
		},
		async logSent(user, at) {
			await ready();
			// De paso, se borra lo de hace más de dos días: solo hace falta para el tope.
			await db.prepare('DELETE FROM family_sent WHERE at < ?').bind(at - 2 * 86_400_000).run();
			await db.prepare('INSERT INTO family_sent (user, at) VALUES (?, ?)').bind(user, at).run();
		}
	};
}

/** En memoria, para los tests. */
export function memoryFamilyStore(): FamilyStore & { rows: Map<string, Member>; sent: { user: string; at: number }[] } {
	const rows = new Map<string, Member>();
	const sent: { user: string; at: number }[] = [];
	return {
		rows,
		sent,
		get: async (user) => structuredClone(rows.get(user) ?? null),
		put: async (user, m) => void rows.set(user, structuredClone(m)),
		remove: async (user) => void rows.delete(user),
		accepting: async () => [...rows].filter(([, m]) => m.accept).map(([user, m]) => ({ user, ...m })),
		sentSince: async (user, since) => sent.filter((s) => s.user === user && s.at >= since).length,
		logSent: async (user, at) => void sent.push({ user, at })
	};
}
