// «Tu mañana» por email: /api/brief. Solo la Action (token de servicio de Access) manda POST { mails: [{ uid,
// subject, text }] } (scripts/alerts/users.ts → postMails). Aquí se busca el email de cada uid en la tabla
// alerts y se envía con Brevo, así el email nunca sale de Cloudflare ni llega a las Actions ni a sus registros.
// Solo a quien tiene «Tu mañana» con email activado, y como mucho uno al día por persona (tabla brief_mail).
// Secrets de Pages: BREVO_API_KEY y BREVO_SENDER (remitente verificado en Brevo). Sin ellos, 503 y solo ntfy.
import { parseConfig } from '../src/lib/alertconfig.ts';
import { tokenOf, verifyIdentity, type AccessConfig } from './access.ts';
import type { AlertRow } from './alerts.ts';
import { readJson } from './feedback.ts';
import { json, type D1Database, type Env } from './prefs.ts';

export interface BriefEnv extends Env {
	BREVO_API_KEY?: string;
	BREVO_SENDER?: string;
}

export interface BriefStore {
	/** El email y la configuración de un uid de alerts. */
	byUid(uid: string): Promise<{ user: string; row: AlertRow } | null>;
	/** Apunta el envío de hoy; false si ya estaba (no se manda otra vez). */
	claim(uid: string, day: string): Promise<boolean>;
}

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;
const UID = /^[0-9a-f]{16}$/;
export const BRIEF_LIMITS = { mails: 500, subject: 120, text: 4000, body: 2_000_000 };

/** Día de Madrid, «2026-10-14». */
const madridDay = (ms: number) => new Date(ms).toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });

export async function handleBrief(
	request: Request,
	env: BriefEnv,
	store: BriefStore | null,
	fetcher: Fetch = fetch,
	now = Date.now()
): Promise<Response> {
	if (!store || !env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) return json(503, { error: 'sin configurar' });
	const token = tokenOf(request);
	const config: AccessConfig = { teamDomain: env.ACCESS_TEAM_DOMAIN, aud: env.ACCESS_AUD };
	const who = token ? await verifyIdentity(token, config, fetcher).catch(() => null) : null;
	if (!who) return json(401, { error: 'sin identificar' });
	// Solo la Action. Una persona no puede mandar emails a nadie.
	if (who.service === undefined || request.method !== 'POST') return json(403, { error: 'solo la Action' });
	if (!env.BREVO_API_KEY?.trim() || !env.BREVO_SENDER?.includes('@')) return json(503, { error: 'sin Brevo' });

	const body = await readJson(request, BRIEF_LIMITS.body);
	if (body instanceof Response) return body;
	const mails = Array.isArray(body.mails) ? body.mails.slice(0, BRIEF_LIMITS.mails) : [];
	const day = madridDay(now);
	let sent = 0;
	for (const m of mails as Record<string, unknown>[]) {
		const { uid, subject, text } = m ?? {};
		if (typeof uid !== 'string' || !UID.test(uid) || typeof subject !== 'string' || typeof text !== 'string') continue;
		const found = await store.byUid(uid);
		const c = found?.row.config;
		if (!found || !c?.on || !c.brief.on || !c.brief.email) continue;
		if (!(await store.claim(uid, day))) continue;
		const res = await fetcher('https://api.brevo.com/v3/smtp/email', {
			method: 'POST',
			headers: { 'api-key': env.BREVO_API_KEY.trim(), 'content-type': 'application/json', accept: 'application/json' },
			body: JSON.stringify({
				sender: { name: 'Arc Terminal', email: env.BREVO_SENDER.trim() },
				to: [{ email: found.user }],
				subject: subject.slice(0, BRIEF_LIMITS.subject),
				textContent: `${text.slice(0, BRIEF_LIMITS.text)}\n\n—\nArc Terminal · ${new URL(request.url).origin}/\nLo cambias o lo quitas en AVISOS: ${new URL(request.url).origin}/avisos`
			}),
			signal: AbortSignal.timeout(10_000)
		}).catch(() => null);
		if (res?.ok) sent++;
	}
	// Solo cuántos: ni emails ni uids en la respuesta (va al registro de la Action).
	return json(200, { sent });
}

let tableReady = false;

export function d1BriefStore(db: D1Database): BriefStore {
	const ready = async () => {
		if (tableReady) return;
		await db.exec('CREATE TABLE IF NOT EXISTS brief_mail (uid TEXT NOT NULL, day TEXT NOT NULL, PRIMARY KEY (uid, day))');
		await db.exec(
			'CREATE TABLE IF NOT EXISTS alerts (user TEXT PRIMARY KEY, uid TEXT NOT NULL, topic TEXT, config TEXT NOT NULL, updated INTEGER NOT NULL)'
		);
		tableReady = true;
	};
	return {
		async byUid(uid) {
			await ready();
			const { results } = await db
				.prepare('SELECT user, uid, topic, config FROM alerts WHERE uid = ?')
				.bind(uid)
				.all<{ user: string; uid: string; topic: string | null; config: string }>();
			const r = results[0];
			if (!r) return null;
			return { user: r.user, row: { uid: r.uid, topic: r.topic, config: parseConfig(JSON.parse(r.config)) } };
		},
		async claim(uid, day) {
			await ready();
			const { results } = await db
				.prepare('INSERT OR IGNORE INTO brief_mail (uid, day) VALUES (?, ?) RETURNING uid')
				.bind(uid, day)
				.all<{ uid: string }>();
			return results.length > 0;
		}
	};
}

/** En memoria, para los tests. */
export function memoryBriefStore(users: Record<string, { user: string; row: AlertRow }>): BriefStore & { claimed: Set<string> } {
	const claimed = new Set<string>();
	return {
		claimed,
		byUid: async (uid) => structuredClone(users[uid] ?? null),
		claim: async (uid, day) => (claimed.has(`${uid}|${day}`) ? false : (claimed.add(`${uid}|${day}`), true))
	};
}
