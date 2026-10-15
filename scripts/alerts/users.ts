// Avisos al móvil de cada usuario de la web (familia y amigos de Sergi), además de los de Sergi.
// - Quiénes y qué quieren: la API de la web privada (/api/alerts?all=1, cloud/alerts.ts), leída con el
//   service token de Access (CF_ACCESS_CLIENT_ID/SECRET). Llega un id aleatorio (uid), el tema de ntfy y la
//   configuración de AVISOS (src/lib/alertconfig.ts). Nunca el email.
// - Los avisos salen de las mismas reglas (rules.ts) y los mismos datos de la pasada; a cada uno solo le
//   llegan los de sus grupos, hasta su nivel, fuera de su silencio (los P1 siempre) y con su tope diario.
//   Sus valores: los que sigue Sergi (si lo elige) y los suyos (sus MIS).
// - Cada uno tiene su historial (qué se le ha enviado), como el de Sergi, guardado SOLO en la caché de Actions
//   (notify-users.json, junto a notify-log.json), con su uid. Nunca en static/data: no se publica.
// SECRETO: los temas de ntfy no se escriben en ningún registro ni archivo (notify.ts los quita de cada línea).
import { DAILY_MAX, parseConfig, wants, type AlertConfig } from '../../src/lib/alertconfig.ts';
import { accessHeaders } from '../lib.ts';
import { PAGES_SITE, SITE } from '../site.ts';
import { QUOTAS } from './config.ts';
import { madrid, RULES, type Alert, type Inputs, type NotifyLog, type Rule } from './rules.ts';

export interface RemoteUser {
	uid: string;
	topic: string;
	config: AlertConfig;
}

const UID = /^[0-9a-f]{16}$/;
const TOPIC = /^arc-[0-9a-f]{32}$/;

/** Los usuarios con avisos, de la respuesta de /api/alerts?all=1. Descarta lo que no tenga la forma esperada. */
export function parseUsers(body: unknown): RemoteUser[] {
	const users = (body as { users?: unknown } | null)?.users;
	if (!Array.isArray(users)) return [];
	return users.flatMap((u) => {
		const { uid, topic, config } = (u ?? {}) as Record<string, unknown>;
		if (typeof uid !== 'string' || !UID.test(uid) || typeof topic !== 'string' || !TOPIC.test(topic)) return [];
		const c = parseConfig(config);
		return c.on ? [{ uid, topic, config: c }] : [];
	});
}

/** Lee la lista de la web privada. null si no se puede (sin service token, sin base, Access lo para…). */
export async function loadUsers(fetcher: typeof fetch = fetch): Promise<RemoteUser[] | null> {
	const headers = accessHeaders();
	if (!Object.keys(headers).length) return null;
	for (const site of [...new Set([SITE, PAGES_SITE])]) {
		try {
			const res = await fetcher(`${site}/api/alerts?all=1`, {
				headers,
				redirect: 'manual',
				signal: AbortSignal.timeout(20_000)
			});
			if (res.ok && res.headers.get('content-type')?.includes('application/json')) return parseUsers(await res.json());
		} catch {
			// La siguiente dirección.
		}
	}
	return null;
}

/** Las reglas de un usuario: solo las de sus grupos, y de lo que saquen, lo que quiere a esta hora. */
export function rulesFor(config: AlertConfig, now: number, rules: Rule[] = RULES): Rule[] {
	const hm = madrid(now).hm;
	return rules
		.filter((r) => wants({ ...config, quiet: null }, r.type, 1, hm))
		.map((r) => ({
			...r,
			run: (d, ctx) => r.run(d, ctx).filter((a) => wants(config, r.type, a.level ?? r.level, hm))
		}));
}

/** Los datos para un usuario: sin la zona del diésel de Sergi y con sus valores. */
export function inputsFor(d: Inputs, config: AlertConfig, base: Set<string>): Inputs {
	const mine = new Set(config.mis);
	const alertQuotes = (d.alertQuotes ?? []).filter(
		(q) => q?.symbol && ((config.baseStocks && base.has(q.symbol)) || mine.has(q.symbol))
	);
	return { ...d, zone: undefined, alertQuotes };
}

/** Lo que hace falta de notify.ts (se pasa para no importarlo en círculo y para los tests). */
export interface Engine {
	pickAlerts: (
		d: Inputs,
		log: NotifyLog,
		now: number,
		rules: Rule[],
		limits: { total: number; quotas: typeof QUOTAS }
	) => { send: Alert[]; skipped: Alert[]; updates: ((log: NotifyLog) => void)[] };
	baselineLog: (d: Inputs, now: number, rules: Rule[]) => NotifyLog;
	trim: (log: NotifyLog, now: number) => NotifyLog;
	post: (topic: string, alert: Alert) => Promise<{ status: number | null }>;
	hello: (now: number) => Alert;
	minute: (ms: number) => string;
}

/**
 * Una pasada para todos los usuarios. Devuelve los historiales nuevos (los de quien ya no está, fuera).
 * `say` registra una línea: nunca lleva el tema.
 */
export async function runUsers(
	users: RemoteUser[],
	d: Inputs,
	base: Set<string>,
	logs: Record<string, NotifyLog>,
	now: number,
	engine: Engine,
	say: (line: string) => void,
	all: Rule[] = RULES
): Promise<Record<string, NotifyLog>> {
	const out: Record<string, NotifyLog> = {};
	for (const u of users) {
		const rules = rulesFor(u.config, now, all);
		const input = inputsFor(d, u.config, base);
		const who = `usuario ${u.uid.slice(0, 4)}`;
		const send = async (alert: Alert, log: NotifyLog) => {
			const { status } = await engine.post(u.topic, alert);
			const ok = status !== null && status >= 200 && status < 300;
			log.entries.push({ k: alert.id, t: engine.minute(now), s: ok ? 'sent' : 'failed', p: alert.level });
			return ok;
		};
		const previous = logs[u.uid];
		if (!previous) {
			// Primera vez: lo de ahora se da por visto y solo sale el aviso de prueba.
			const log = engine.baselineLog(input, now, rules);
			const ok = await send(engine.hello(now), log);
			say(`ntfy · ${who}: nuevo, aviso de prueba ${ok ? 'enviado' : 'no enviado'}`);
			out[u.uid] = log;
			continue;
		}
		const log = engine.trim(previous, now);
		const picked = engine.pickAlerts(input, log, now, rules, {
			total: Math.min(u.config.daily, DAILY_MAX),
			quotas: QUOTAS
		});
		for (const fn of picked.updates) fn(log);
		let sent = 0;
		for (const alert of picked.send) {
			if (await send(alert, log)) sent++;
			alert.commit?.(log);
		}
		if (picked.send.length || picked.skipped.length)
			say(
				`ntfy · ${who}: ${sent} de ${picked.send.length} enviados${picked.skipped.length ? `, ${picked.skipped.length} no caben` : ''}`
			);
		out[u.uid] = log;
	}
	return out;
}
