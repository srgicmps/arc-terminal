// Avisos al móvil de cada usuario de la web (familia y amigos de Sergi), además de los de Sergi.
// - Quiénes y qué quieren: la API de la web privada (/api/alerts?all=1, cloud/alerts.ts), leída con el
//   service token de Access (CF_ACCESS_CLIENT_ID/SECRET). Llega un id aleatorio (uid), el tema de ntfy y la
//   configuración de AVISOS (src/lib/alertconfig.ts). Nunca el email.
// - Los avisos salen de las mismas reglas (rules.ts) y los mismos datos de la pasada; a cada uno solo le
//   llegan los de sus grupos, hasta su nivel, fuera de su silencio (los P1 siempre) y con su tope diario.
//   Sus valores: los que sigue Sergi (si lo elige) y los suyos (sus MIS).
// - Cada uno tiene su historial (qué se le ha enviado), como el de Sergi, guardado SOLO en la caché de Actions
//   (notify-users.json, junto a notify-log.json), con su uid. Nunca en static/data: no se publica.
// - Si tiene avisos en algún navegador (Web Push, /api/push, cloud/push.ts), cada aviso sale también por ahí:
//   el mismo aviso, el mismo cupo y una sola entrada en el historial (el canal no cuenta doble). La Action solo
//   manda el uid y el texto; los endpoints de los navegadores no salen nunca de Cloudflare.
// SECRETO: los temas de ntfy no se escriben en ningún registro ni archivo (notify.ts los quita de cada línea).
import { DAILY_MAX, inQuiet, parseConfig, wants, type AlertConfig } from '../../src/lib/alertconfig.ts';
import { accessHeaders } from '../lib.ts';
import { PAGES_SITE, SITE } from '../site.ts';
import { briefAlert, briefDue, briefLines, type Weather } from './brief.ts';
import { QUOTAS } from './config.ts';
import { madrid, RULES, type Alert, type Inputs, type NotifyLog, type Rule } from './rules.ts';
import { ordersOf, userRules } from './user.ts';
import { homeRules } from './home.ts';
import type { AirData } from '../../src/lib/weather.ts';
import type { FuelStation } from '../../src/lib/fuel.ts';

export interface RemoteUser {
	uid: string;
	/** null solo en la cuenta del administrador si no tiene los avisos activados (sus alertas van por NTFY_TOPIC). */
	topic: string | null;
	config: AlertConfig;
	/** La cuenta de Sergi: sus alertas y palabras salen con los avisos de Sergi (notify.ts), no aquí. */
	admin?: boolean;
}

const UID = /^[0-9a-f]{16}$/;
const TOPIC = /^arc-[0-9a-f]{32}$/;

/** Los usuarios con avisos, de la respuesta de /api/alerts?all=1. Descarta lo que no tenga la forma esperada. */
export function parseUsers(body: unknown): RemoteUser[] {
	const users = (body as { users?: unknown } | null)?.users;
	if (!Array.isArray(users)) return [];
	return users.flatMap((u): RemoteUser[] => {
		const { uid, topic, config, admin } = (u ?? {}) as Record<string, unknown>;
		if (typeof uid !== 'string' || !UID.test(uid)) return [];
		const t = typeof topic === 'string' && TOPIC.test(topic) ? topic : null;
		const c = parseConfig(config);
		if (admin === true) return [{ uid, topic: c.on ? t : null, config: c, admin: true }];
		return c.on && t ? [{ uid, topic: t, config: c }] : [];
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

/** POST con el service token a /api/alerts (la web privada o, si no responde, la de Pages). El JSON o null. */
async function postAlerts(query: string, body: unknown, fetcher: typeof fetch): Promise<Record<string, unknown> | null> {
	const headers = accessHeaders();
	if (!Object.keys(headers).length) return null;
	for (const site of [...new Set([SITE, PAGES_SITE])]) {
		try {
			const res = await fetcher(`${site}/api/alerts?${query}`, {
				method: 'POST',
				headers: { ...headers, 'content-type': 'application/json' },
				body: JSON.stringify(body),
				redirect: 'manual',
				signal: AbortSignal.timeout(20_000)
			});
			if (res.ok && res.headers.get('content-type')?.includes('application/json')) return (await res.json()) as Record<string, unknown>;
		} catch {
			// La siguiente dirección.
		}
	}
	return null;
}

/** Borra de cada cuenta las alertas de precio que ya han avisado. Una línea para el registro (sin uids). */
export async function postFired(fired: { uid: string; ids: string[] }[], fetcher: typeof fetch = fetch): Promise<string> {
	const body = await postAlerts('fired=1', { fired }, fetcher);
	const n = fired.reduce((sum, f) => sum + f.ids.length, 0);
	return body ? `ntfy: ${body.removed ?? 0} de ${n} alertas cumplidas borradas` : `ntfy: no se pudieron borrar ${n} alertas cumplidas (se reintenta)`;
}

/** Pasa a la cuenta de Sergi las órdenes que había en issues. true si la web lo ha guardado. */
export async function postMigration(
	orders: { prices: unknown[]; mis: string[]; words: string[] },
	fetcher: typeof fetch = fetch
): Promise<boolean> {
	return (await postAlerts('migrate=1', orders, fetcher)) !== null;
}

/**
 * Manda los «Tu mañana» con email a la web (/api/brief), que busca cada email por su uid y lo envía con Brevo.
 * Devuelve una línea para el registro (sin uids ni emails).
 */
export async function postMails(mails: BriefMail[], fetcher: typeof fetch = fetch): Promise<string> {
	const headers = accessHeaders();
	if (!mails.length || !Object.keys(headers).length) return '';
	for (const site of [...new Set([SITE, PAGES_SITE])]) {
		try {
			const res = await fetcher(`${site}/api/brief`, {
				method: 'POST',
				headers: { ...headers, 'content-type': 'application/json' },
				body: JSON.stringify({ mails }),
				redirect: 'manual',
				signal: AbortSignal.timeout(30_000)
			});
			if (res.headers.get('content-type')?.includes('application/json')) {
				const body = (await res.json()) as { sent?: number; error?: string };
				return res.ok
					? `email · «Tu mañana»: ${body.sent ?? 0} de ${mails.length} enviados`
					: `email · «Tu mañana»: no se envían (${body.error ?? res.status})`;
			}
		} catch {
			// La siguiente dirección.
		}
	}
	return 'email · «Tu mañana»: la web no responde';
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

/**
 * Sus alertas de precio (siempre llegan, como los P1) y sus palabras vigiladas (fuera de su silencio). Las de
 * Sergi no: salen con sus avisos de siempre (notify.ts).
 */
export function ownRulesFor(u: RemoteUser, now: number): Rule[] {
	if (u.admin) return [];
	const hm = madrid(now).hm;
	return userRules(ordersOf(u.config)).map((r) =>
		r.type === 'vigila' ? { ...r, run: (d, ctx) => (inQuiet(hm, u.config.quiet) ? [] : r.run(d, ctx)) } : r
	);
}

/** Los datos para un usuario: sin la zona del diésel de Sergi y con sus valores. */
export function inputsFor(d: Inputs, config: AlertConfig, base: Set<string>): Inputs {
	// Sus valores y los de sus alertas de precio.
	const mine = new Set([...config.mis, ...config.prices.map((p) => p.asset)]);
	const alertQuotes = (d.alertQuotes ?? []).filter(
		(q) => q?.symbol && ((config.baseStocks && base.has(q.symbol)) || mine.has(q.symbol))
	);
	return { ...d, zone: undefined, alertQuotes };
}

/** Lo que responde /api/push?send=1: solo cuentas, nunca endpoints. */
export interface PushResult {
	sent: number;
	gone: number;
	/** Cuántos envíos con cada código (201, 410…; «0», sin respuesta; «web», /api/push no responde). */
	codes: Record<string, number>;
}

/** Los uid con avisos en algún navegador (/api/push?all=1). null si no se puede (sin service token, sin clave VAPID…). */
export async function loadPushUids(fetcher: typeof fetch = fetch): Promise<Set<string> | null> {
	const headers = accessHeaders();
	if (!Object.keys(headers).length) return null;
	for (const site of [...new Set([SITE, PAGES_SITE])]) {
		try {
			const res = await fetcher(`${site}/api/push?all=1`, { headers, redirect: 'manual', signal: AbortSignal.timeout(20_000) });
			if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
				const uids = ((await res.json()) as { uids?: unknown }).uids;
				return new Set(Array.isArray(uids) ? uids.filter((u): u is string => typeof u === 'string' && UID.test(u)) : []);
			}
			// 503 (sin la clave VAPID): no hay push, y la otra dirección dirá lo mismo.
			if (res.status === 503) return null;
		} catch {
			// La siguiente dirección.
		}
	}
	return null;
}

/** El texto del aviso sin Markdown (en el navegador sale tal cual): sin ** ni __ y los enlaces, solo su texto. */
export const plainBody = (alert: Alert) =>
	alert.markdown ? alert.body.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\*\*|__|`/g, '') : alert.body;

/** Manda un aviso a los navegadores de un uid (/api/push?send=1). null si la web no responde. */
export async function postPush(uid: string, alert: Alert, fetcher: typeof fetch = fetch): Promise<PushResult | null> {
	const headers = accessHeaders();
	if (!Object.keys(headers).length) return null;
	const body = JSON.stringify({ uid, title: alert.title, body: plainBody(alert), url: alert.click || `${SITE}/`, level: alert.level });
	for (const site of [...new Set([SITE, PAGES_SITE])]) {
		try {
			const res = await fetcher(`${site}/api/push?send=1`, {
				method: 'POST',
				headers: { ...headers, 'content-type': 'application/json' },
				body,
				redirect: 'manual',
				signal: AbortSignal.timeout(30_000)
			});
			if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
				const r = (await res.json()) as Partial<PushResult>;
				return { sent: Number(r.sent) || 0, gone: Number(r.gone) || 0, codes: r.codes && typeof r.codes === 'object' ? r.codes : {} };
			}
		} catch {
			// La siguiente dirección.
		}
	}
	return null;
}

/**
 * El envío por push para el motor de avisos: solo para los uid que tienen algún navegador. undefined si no hay
 * ninguno (o no hay /api/push): entonces todo sale como siempre, solo por ntfy.
 */
export async function pushSender(say: (line: string) => void = () => {}, fetcher: typeof fetch = fetch): Promise<Engine['push']> {
	const uids = await loadPushUids(fetcher);
	say(uids ? `push: ${uids.size} usuarios con avisos en el navegador` : 'push: sin /api/push (sin clave VAPID o sin service token)');
	if (!uids?.size) return undefined;
	return async (uid, alert) => (uids.has(uid) ? ((await postPush(uid, alert, fetcher)) ?? { sent: 0, gone: 0, codes: { web: 1 } }) : null);
}

/** Lo que ha pasado con push en una pasada, para una línea del registro (sin uids ni endpoints). */
export function pushLine(t: { alerts: number; users: Set<string>; sent: number; gone: number; codes: Record<string, number> }): string {
	const label = (c: string) => (c === '0' ? 'sin respuesta' : c === 'web' ? '/api/push no responde' : c);
	const codes = Object.entries(t.codes)
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([c, n]) => `${label(c)}×${n}`)
		.join(', ');
	return `push: ${t.alerts} avisos a ${t.users.size} usuarios, ${t.sent} entregados (${codes || 'sin envíos'})${t.gone ? `; ${t.gone} navegadores caducados, borrados` : ''}`;
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
	/** El tiempo de hoy en un sitio (brief.ts → weatherAt). Sin él, «Tu mañana» va sin tiempo. */
	weather?: (lat: number, lon: number) => Promise<Weather | null>;
	/** Aire y polen de un sitio (home.ts → airAt). Sin él, no hay aviso de polen. */
	air?: (lat: number, lon: number) => Promise<AirData | null>;
	/** Una gasolinera de FUEL por zona e id (notify.ts lee fuel.json o fuel/<zona>.json). */
	station?: (zone: string, id: string) => Promise<FuelStation | null>;
	/** Web Push (pushSender): null si ese uid no tiene navegadores. Sin él, solo ntfy. */
	push?: (uid: string, alert: Alert) => Promise<PushResult | null>;
}

/** Un «Tu mañana» que también va por email: la web busca el email por el uid (cloud/brief.ts). */
export interface BriefMail {
	uid: string;
	subject: string;
	text: string;
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
	all: Rule[] = RULES,
	/** Aquí se dejan los «Tu mañana» que van por email. */
	mails: BriefMail[] = []
): Promise<Record<string, NotifyLog>> {
	const out: Record<string, NotifyLog> = {};
	// Un sitio, una consulta del tiempo por pasada (aunque lo compartan varios).
	const skies = new Map<string, Promise<Weather | null>>();
	const weatherOf = (p: { lat: number; lon: number }) => {
		const key = `${p.lat},${p.lon}`;
		if (!skies.has(key)) skies.set(key, engine.weather?.(p.lat, p.lon) ?? Promise.resolve(null));
		return skies.get(key)!;
	};
	// Lo de push en esta pasada: solo cuentas, para una línea al final.
	const web = { alerts: 0, users: new Set<string>(), sent: 0, gone: 0, codes: {} as Record<string, number> };
	const airs = new Map<string, Promise<AirData | null>>();
	const airOf = (p: { lat: number; lon: number }) => {
		const key = `${p.lat},${p.lon}`;
		if (!airs.has(key)) airs.set(key, engine.air?.(p.lat, p.lon) ?? Promise.resolve(null));
		return airs.get(key)!;
	};
	for (const u of users) {
		if (!u.topic || !u.config.on) continue;
		const topic = u.topic;
		// Avisos de casa: fuera de su silencio. El polen, del sitio de «Tu mañana».
		const place = u.config.brief.place;
		const air = u.config.home.pollen && place ? await airOf(place) : null;
		const tomorrow = air?.days[1] ?? null;
		const fav = u.config.home.fuel;
		const station = fav ? ((await engine.station?.(fav.zone, fav.id)) ?? null) : null;
		const home = inQuiet(madrid(now).hm, u.config.quiet) ? [] : homeRules(u.config, tomorrow, station);
		const rules = [...rulesFor(u.config, now, all), ...ownRulesFor(u, now), ...home];
		const input = inputsFor(d, u.config, base);
		const who = `usuario ${u.uid.slice(0, 4)}`;
		// Por ntfy y, si tiene, por sus navegadores, a la vez. Una sola entrada en el historial: el aviso cuenta una
		// vez en el cupo y vale como enviado si ha llegado por cualquiera de los dos.
		const send = async (alert: Alert, log: NotifyLog) => {
			const [{ status }, pushed] = await Promise.all([engine.post(topic, alert), engine.push?.(u.uid, alert) ?? null]);
			if (pushed) {
				web.alerts++;
				web.users.add(u.uid);
				web.sent += pushed.sent;
				web.gone += pushed.gone;
				for (const [c, n] of Object.entries(pushed.codes)) web.codes[c] = (web.codes[c] ?? 0) + n;
			}
			const ok = (status !== null && status >= 200 && status < 300) || (pushed?.sent ?? 0) > 0;
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
		// «Tu mañana»: lo ha pedido él a esa hora, así que no cuenta el silencio ni el tope.
		if (briefDue(u.config, log, now)) {
			const place = u.config.brief.place;
			const weather = place ? await weatherOf(place) : null;
			const alert = briefAlert(briefLines(u.config, input, madrid(now).date, base, weather, now), now);
			const ok = await send(alert, log);
			if (u.config.brief.email) mails.push({ uid: u.uid, subject: alert.title, text: alert.body });
			say(`ntfy · ${who}: «Tu mañana» ${ok ? 'enviado' : 'no enviado'}${u.config.brief.email ? ' (y por email)' : ''}`);
		}
		out[u.uid] = log;
	}
	if (web.alerts) say(pushLine(web));
	return out;
}
