/// <reference types="node" />
// Avisos al móvil con ntfy (https://ntfy.sh). Lo ejecuta la Action después de `pnpm data` y de
// scripts/issues.ts (solo en el cron, los push a main y a mano; nunca en los PR).
//
// Las reglas (qué se avisa) están en scripts/alerts/rules.ts y los umbrales y cupos, en
// scripts/alerts/config.ts. Este archivo es la mecánica:
// - Cada aviso tiene un id único y estable; un id ya apuntado en el historial no se repite nunca.
// - Niveles P1–P4 con cupo diario (día de Madrid): P1 sin límite, P2 hasta 25, P3 hasta 15, P4 hasta 3
//   (los dos resúmenes y SEMANA). Tope total de 50 al día, solo contra bucles. Si no caben todos, salen primero los de
//   nivel más alto y, a igual nivel, los más recientes. Lo que no cabe no se apunta: se vuelve a mirar
//   en la pasada siguiente (y al día siguiente, si sigue siendo relevante). El aviso que llena el tope
//   lleva en el título «⚠ Límite diario alcanzado ·».
// - Se envía a cualquier hora (Sergi usa el «No molestar» del móvil).
// - Si ntfy da 429 o falla, ese aviso se pierde (se apunta como «failed» y no se reintenta).
//
// El historial (static/data/notify-log.json) se publica con la web y, además, se guarda en la caché de
// Actions justo después de este paso (NOTIFY_CACHE, ver deploy.yml). Así, si algo falla después de enviar
// (check, test, build o deploy) y la web no se publica, la pasada siguiente no repite los avisos: se usa el
// más reciente de los dos (el que tenga el último intento). Solo lleva ids, horas, niveles y los valores
// que se comparan entre pasadas: NUNCA el tema ni la zona del diésel.
// Si no se puede leer ninguno (primera vez, o se perdieron), todo lo de ahora se apunta como ya visto
// («baseline») y no se envía nada: así nunca sale una ráfaga de avisos repetidos.
//
// SECRETO: NTFY_TOPIC es la única protección del canal (quien lo sepa puede leer y escribir). No se
// escribe en ningún registro, ni la URL completa, ni la respuesta de ntfy (que lo incluye), ni en el JSON.
//
// ZONA DEL DIÉSEL: ALERT_FUEL_ZONE (opcional) es la provincia («07», «28») o «menorca». Tampoco se escribe
// en ningún registro ni en el JSON: los ids y las claves del historial dicen «zona», nunca cuál.
//
// Uso: `NTFY_TOPIC=… [NOTIFY_CACHE=.notify-cache/notify-log.json] node scripts/notify.ts`. Sin NTFY_TOPIC,
// sale sin hacer nada.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findProvince, type FuelStation } from '../src/lib/fuel.ts';
import { DAILY_TOTAL, KEEP_DAYS, NTFY_PRIORITY, QUOTAS, type Level } from './alerts/config.ts';
import {
	emptyLog,
	FILES,
	madrid,
	RULES,
	SITE,
	type Alert,
	type FuelZone,
	type Inputs,
	type LogEntry,
	type NotifyLog,
	type Rule
} from './alerts/rules.ts';
import { minute } from './history.ts';
import { EU_ADRS, EU_GAP_MS, fetchQuotes } from './sources/alert-quotes.ts';
import { accessHeaders, fetchPublished } from './lib.ts';
import { github, redact } from './issues.ts';
import { closeIssue, emptyRequests, loadRequests, type Api, type Requests } from './requests.ts';
import { alertId, userRules, type UserInputs } from './alerts/user.ts';
import { loadUsers, runUsers, type RemoteUser } from './alerts/users.ts';

const NTFY = 'https://ntfy.sh';
const DAY = 86_400_000;

/**
 * Todos los avisos que tocarían ahora según los datos, sin mirar lo ya enviado ni los cupos, y los
 * cambios del historial que hay que guardar pase lo que pase.
 */
export function candidates(
	d: Inputs,
	log: NotifyLog,
	now: number,
	rules: Rule[] = RULES
): { alerts: Alert[]; updates: ((log: NotifyLog) => void)[] } {
	const updates: ((log: NotifyLog) => void)[] = [];
	const ctx = { now, today: madrid(now).date, log, update: (fn: (log: NotifyLog) => void) => void updates.push(fn) };
	const alerts = rules.flatMap((rule) =>
		rule.run(d, ctx).map((a): Alert => ({ ...a, type: rule.type, level: a.level ?? rule.level }))
	);
	return { alerts, updates };
}

/** Orden de salida: nivel más alto primero (P1 antes que P2…); a igual nivel, el más reciente. */
export const byImportance = (a: Alert, b: Alert) => a.level - b.level || b.time - a.time;

/** Intentos de hoy (día de Madrid), en total y por nivel. Lo visto sin enviar no cuenta. */
export function usedToday(log: NotifyLog, now: number): { total: number; byLevel: Record<Level, number> } {
	const today = madrid(now).date;
	const byLevel: Record<Level, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
	let total = 0;
	for (const e of log.entries) {
		if (e.s === 'baseline' || madrid(Date.parse(e.t)).date !== today) continue;
		total++;
		if (e.p) byLevel[e.p]++;
	}
	return { total, byLevel };
}

/**
 * Qué enviar ahora: quita los ids ya apuntados (enviados, fallidos o vistos) y reparte el hueco de hoy por
 * orden de importancia, respetando el cupo de cada nivel y el tope total. `skipped`: lo que toca pero no
 * cabe (no se apunta). `updates`: cambios del historial que se guardan siempre.
 */
export function pickAlerts(
	d: Inputs,
	log: NotifyLog,
	now: number,
	rules: Rule[] = RULES,
	limits: { total: number; quotas: Record<Level, number> } = { total: DAILY_TOTAL, quotas: QUOTAS }
): { send: Alert[]; skipped: Alert[]; updates: ((log: NotifyLog) => void)[] } {
	const known = new Set(log.entries.map((e) => e.k));
	const { alerts, updates } = candidates(d, log, now, rules);
	const fresh = [...new Map(alerts.filter((a) => !known.has(a.id)).map((a) => [a.id, a])).values()].sort(byImportance);
	const used = usedToday(log, now);
	const send: Alert[] = [];
	const skipped: Alert[] = [];
	for (const a of fresh) {
		if (used.total < limits.total && used.byLevel[a.level] < limits.quotas[a.level]) {
			send.push(a);
			used.total++;
			used.byLevel[a.level]++;
		} else skipped.push(a);
	}
	// Si con este envío se llega justo al tope, el último que sale lo dice (sin añadir un aviso más).
	if (send.length && used.total === limits.total) {
		const last = send[send.length - 1];
		send[send.length - 1] = { ...last, title: LIMIT_PREFIX + last.title };
	}
	return { send, skipped, updates };
}

/** Prefijo del último aviso del día cuando se llega al tope total (DAILY_TOTAL). */
export const LIMIT_PREFIX = '⚠ Límite diario alcanzado · ';

/** Lo que hay ahora, apuntado como ya visto. Para cuando no hay historial: no se envía nada. */
export function baselineLog(d: Inputs, now: number, rules: Rule[] = RULES): NotifyLog {
	const log = emptyLog();
	const { alerts, updates } = candidates(d, log, now, rules);
	for (const fn of updates) fn(log);
	const t = minute(now);
	for (const a of alerts) {
		a.commit?.(log);
		log.entries.push({ k: a.id, t, s: 'baseline', p: a.level });
	}
	return log;
}

/** Deja solo los últimos KEEP_DAYS días de intentos (los valores que se comparan entre pasadas se quedan). */
export function trim(log: NotifyLog, now: number): NotifyLog {
	const since = now - KEEP_DAYS * DAY;
	return { ...structuredClone(log), entries: log.entries.filter((e) => Date.parse(e.t) >= since) };
}

const isObject = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object' && !Array.isArray(v);

/** Lee un historial publicado; null si no tiene la forma esperada. */
export function parseLog(body: unknown): NotifyLog | null {
	const data = isObject(body) ? body.data : undefined;
	if (!isObject(data) || !Array.isArray(data.entries)) return null;
	const entries = data.entries.filter(
		(e): e is LogEntry =>
			isObject(e) &&
			typeof e.k === 'string' &&
			typeof e.t === 'string' &&
			Number.isFinite(Date.parse(e.t)) &&
			['sent', 'failed', 'baseline'].includes(String(e.s))
	);
	const last = Object.fromEntries(
		Object.entries(isObject(data.last) ? data.last : {}).filter(([, v]) => typeof v === 'string')
	);
	return {
		entries,
		last: last as Record<string, string>,
		poly: (isObject(data.poly) ? data.poly : {}) as NotifyLog['poly']
	};
}

// ---------- ntfy ----------

/** Las cabeceras HTTP solo admiten ASCII: el título va en RFC 2047, que ntfy entiende. */
export function encodeHeader(text: string): string {
	return /^[\x20-\x7e]*$/.test(text) ? text : `=?UTF-8?B?${Buffer.from(text, 'utf8').toString('base64')}?=`;
}

/** Cabeceras de ntfy de un aviso. */
export function headers(alert: Alert): Record<string, string> {
	return {
		Title: encodeHeader(alert.title),
		Priority: String(NTFY_PRIORITY[alert.level]),
		Tags: alert.tags,
		Click: alert.click,
		...(alert.markdown ? { 'X-Markdown': 'yes' } : {}),
		'Content-Type': 'text/plain; charset=utf-8'
	};
}

/** Envía un aviso. Devuelve el código HTTP, o null si no hubo respuesta. Nunca lanza. */
export async function post(topic: string, alert: Alert): Promise<{ status: number | null; error?: string }> {
	try {
		const res = await fetch(`${NTFY}/${encodeURIComponent(topic)}`, {
			method: 'POST',
			headers: headers(alert),
			body: alert.body,
			signal: AbortSignal.timeout(15_000)
		});
		// La respuesta de ntfy incluye el tema: no se lee ni se registra.
		await res.body?.cancel().catch(() => {});
		return { status: res.status };
	} catch (error) {
		return { status: null, error: error instanceof Error ? error.message : String(error) };
	}
}

/** Quita el tema (y cualquier «?…» de URL) de un texto antes de registrarlo. */
export function scrub(text: string, topic: string): string {
	const clean = redact(text, [topic]);
	return topic ? clean.replaceAll(topic, '***').replaceAll(encodeURIComponent(topic), '***') : clean;
}

// ---------- Ejecución ----------

async function readData(dir: string, name: string): Promise<unknown> {
	try {
		return (JSON.parse(await readFile(`${dir}/${name}.json`, 'utf8')) as { data?: unknown }).data;
	} catch {
		return undefined;
	}
}

/**
 * La zona del diésel a partir del secreto: «menorca» (fuel.json) o una provincia de fuel-es.json, por su
 * número o su nombre. Las gasolineras salen de fuel.json o de fuel/<id>.json. null si no se reconoce.
 */
export async function loadZone(raw: string | undefined, d: Inputs, dir: string): Promise<FuelZone | null> {
	const provinces = Array.isArray(d.fuelEs?.provinces) ? d.fuelEs.provinces : [];
	const id = findProvince(raw ?? null, provinces);
	if (!id) return null;
	if (id === 'menorca') return { id, name: 'Menorca', stations: d.fuel?.stations };
	let stations: FuelStation[] | undefined;
	try {
		const body: unknown = JSON.parse(await readFile(`${dir}/fuel/${id}.json`, 'utf8'));
		if (Array.isArray(body)) stations = body as FuelStation[];
	} catch {
		// Sin el archivo de la provincia no hay «la más barata»; lo demás sigue.
	}
	return { id, name: provinces.find((p) => p.id === id)?.name ?? id, stations };
}

/** Aviso de prueba de la primera pasada (sin historial publicado). */
export const HELLO = (now: number): Alert => ({
	id: 'hello',
	type: 'hello',
	level: 3,
	title: 'Arc Terminal conectado ✅',
	body: 'Los avisos llegarán por aquí: P1 urgentes, P2 datos y mercados, P3 resto y resúmenes a las 8:05 y a las 22:15.',
	tags: 'white_check_mark',
	click: SITE + '/',
	time: now
});

/** En el historial: cuándo se pidieron los ADR por última vez (ISO). */
const ADR_KEY = 'adr:fetched';
const ADR_EVERY_MS = 60 * 60_000;

/** ¿Es una clave de un ADR europeo («stock:EADSY», «stock:EADSY:2026-10-14T10:00Z») o la hora de su consulta? */
const isEuAdr = (key: string) => key === ADR_KEY || EU_ADRS.some((s) => key === `stock:${s}` || key.startsWith(`stock:${s}:`));

/**
 * La copia del historial que se publica en la web, sin rastro de los ADR europeos (D25: datos de Finnhub
 * solo para los avisos; el estado de los escalones lleva sus precios). La caché de Actions guarda la entera.
 */
export function publicLog(log: NotifyLog): NotifyLog {
	return {
		...log,
		entries: log.entries.filter((e) => !isEuAdr(e.k)),
		last: Object.fromEntries(Object.entries(log.last).filter(([k]) => !isEuAdr(k)))
	};
}

async function publishedLog(): Promise<NotifyLog | null> {
	try {
		const res = await fetchPublished('notify-log.json', 20_000);
		return res?.ok ? parseLog(await res.json()) : null;
	} catch {
		return null;
	}
}

/** El historial guardado en la caché de Actions (un archivo local), o null si no está o está roto. */
async function cachedLog(path: string | undefined): Promise<NotifyLog | null> {
	if (!path) return null;
	try {
		return parseLog(JSON.parse(await readFile(path, 'utf8')));
	} catch {
		return null;
	}
}

/** Hora (ms) del último intento apuntado en un historial; -Infinity si no tiene ninguno. */
export const lastAttempt = (log: NotifyLog): number =>
	log.entries.reduce((max, e) => Math.max(max, Date.parse(e.t)), -Infinity);

/**
 * El historial más reciente entre el de la caché y el publicado: el que tenga el último intento (`t`).
 * A igualdad gana la caché, que se guarda justo después de enviar y nunca va por detrás de la web.
 */
export function newestLog(cached: NotifyLog | null, published: NotifyLog | null): NotifyLog | null {
	if (!cached || !published) return cached ?? published;
	return lastAttempt(published) > lastAttempt(cached) ? published : cached;
}

/** Historial de los usuarios de la web: solo en la caché de Actions, junto al de Sergi. Nunca en static/data. */
export const USERS_FILE = 'notify-users.json';

/** Los historiales de los usuarios ({ users: { uid: historial } }); vacío si no hay o no vale. */
export async function readUserLogs(path: string): Promise<Record<string, NotifyLog>> {
	try {
		const body = JSON.parse(await readFile(path, 'utf8')) as { users?: Record<string, unknown> };
		return Object.fromEntries(
			Object.entries(isObject(body.users) ? body.users : {}).flatMap(([uid, log]) => {
				const parsed = parseLog({ data: log });
				return parsed ? [[uid, parsed]] : [];
			})
		);
	} catch {
		return {};
	}
}

/** Como mucho, tantos valores de MIS y de las alertas por pasada (Finnhub gratis: 60 llamadas/min). */
const USER_QUOTES = 15;

/**
 * Cierra los issues de la barra que ya han hecho su trabajo: alertas avisadas (o fallidas: no se
 * reintentan), y los que planRequests manda cerrar. Los comentarios son públicos: sin datos privados.
 */
async function closeRequests(api: Api, repo: string, req: Requests, log: NotifyLog, say: (line: string) => void) {
	const tried = new Map(log.entries.filter((e) => e.s !== 'baseline').map((e) => [e.k, e.s]));
	const done = req.alerts.flatMap(({ issue }) => {
		const s = tried.get(alertId(issue));
		if (!s) return [];
		return [{ issue, reason: s === 'sent' ? 'La alerta se ha cumplido y ha llegado al móvil. Se cierra.' : 'La alerta se ha cumplido, pero el aviso no se pudo enviar. Se cierra.' }];
	});
	for (const { issue, reason } of [...done, ...req.close]) {
		try {
			await closeIssue(api, repo, issue, reason);
			say(`ntfy: issue #${issue} cerrado`);
		} catch {
			say(`ntfy: no se pudo cerrar el issue #${issue}`);
		}
	}
}

/**
 * Todo el proceso: lee los datos de `dir`, decide, envía y escribe `dir`/notify-log.json. Devuelve las
 * líneas que ha registrado (también van a console.log). No lanza: un fallo se registra saneado.
 */
export async function runNotify({
	topic,
	zone,
	dir = 'static/data',
	cache,
	finnhubKey,
	euGap = EU_GAP_MS,
	repo,
	token,
	now = Date.now()
}: {
	topic: string | undefined;
	/** Zona del diésel (secreto ALERT_FUEL_ZONE). */
	zone?: string;
	dir?: string;
	/** Archivo del historial en la caché de Actions (se lee y se reescribe). */
	cache?: string;
	/** FINNHUB_API_KEY: con ella se piden los ADR europeos (D25), solo en memoria. */
	finnhubKey?: string;
	/** Pausa entre llamadas de los ADR (en los tests, 0). */
	euGap?: number;
	/** GITHUB_REPOSITORY y GITHUB_TOKEN: con ellos se leen las órdenes de la barra (scripts/requests.ts). */
	repo?: string;
	token?: string;
	now?: number;
}): Promise<string[]> {
	const lines: string[] = [];
	const secret = topic?.trim() ?? '';
	// Temas que nunca pueden salir en el registro: el de Sergi y los de los usuarios (alerts/users.ts).
	const hidden = [secret];
	const say = (line: string) => {
		const safe = hidden.filter(Boolean).reduce((text, t) => scrub(text, t), line);
		lines.push(safe);
		console.log(safe);
	};
	if (!secret) {
		say('ntfy: sin tema configurado (NTFY_TOPIC), no se envía nada');
		return lines;
	}
	try {
		const inputs: Inputs = {};
		for (const [key, file] of Object.entries(FILES)) {
			(inputs as Record<string, unknown>)[key] = await readData(dir, file);
		}
		if (zone?.trim()) {
			const found = await loadZone(zone.trim(), inputs, dir);
			if (found) {
				inputs.zone = found;
				say('ntfy: zona del diésel reconocida');
			}
			// Sin decir cuál: la zona no sale en el registro.
			else say('ntfy: ALERT_FUEL_ZONE no corresponde a ninguna zona; el diésel se vigila solo en España');
		}
		// Órdenes de la barra (27-B): alertas propias, MIS y palabras vigiladas, de los issues del dueño.
		let req: Requests = emptyRequests();
		let api: Api | null = null;
		if (repo && token) {
			try {
				api = github(token);
				req = await loadRequests(api, repo);
				say(`ntfy: órdenes de la barra: ${req.alerts.length} alertas, MIS ${req.mis?.length ?? '—'}, ${req.words?.length ?? 0} palabras`);
			} catch (error) {
				api = null;
				say(`ntfy: no se pudieron leer las órdenes de la barra (${error instanceof Error ? error.message : 'error'})`);
			}
		}
		// Avisos de los usuarios de la web (alerts/users.ts): solo con la caché, donde va su historial, y con el
		// service token de Access, que es con lo que se lee la lista.
		let users: RemoteUser[] | null = null;
		if (cache && Object.keys(accessHeaders()).length) {
			users = await loadUsers();
			for (const u of users ?? []) hidden.push(u.topic);
			say(users ? `ntfy: ${users.length} usuarios con avisos` : 'ntfy: sin lista de usuarios (sin service token o sin /api/alerts)');
		}
		// Los valores que sigue Sergi (alert-quotes.json y los ADR europeos): los que «baseStocks» da a los demás.
		const base = new Set<string>([...(inputs.alertQuotes ?? []).flatMap((q) => (q?.symbol ? [q.symbol] : [])), ...EU_ADRS]);
		(inputs as UserInputs).search = (await readData(dir, 'search')) as UserInputs['search'];
		// Valores de MIS y de las alertas que no estén ya en alert-quotes: cotización solo en memoria.
		const have = new Set((inputs.alertQuotes ?? []).map((q) => q?.symbol));
		const wanted = [...(req.mis ?? []), ...req.alerts.map((a) => a.alert.asset), ...(users ?? []).flatMap((u) => u.config.mis)];
		const extra = [...new Set(wanted)].filter((s) => /^[A-Z0-9.]{1,12}$/.test(s) && !have.has(s)).slice(0, USER_QUOTES);
		if (extra.length && finnhubKey?.trim()) {
			const { quotes, failed } = await fetchQuotes(extra, finnhubKey.trim(), euGap);
			inputs.alertQuotes = [...(inputs.alertQuotes ?? []), ...quotes];
			say(`ntfy: ${quotes.length} de ${extra.length} valores de MIS y alertas${failed.length ? ` (sin dato: ${failed.length})` : ''}`);
		}
		const previous = newestLog(await cachedLog(cache), await publishedLog());
		// ADR europeos (D25): solo en memoria para decidir los avisos; nunca se escriben en static/data. Solo
		// traen el cierre diario, así que se piden como mucho una vez por hora (la hora va en el historial).
		const lastAdr = Date.parse(previous?.last[ADR_KEY] ?? '');
		const adrDue = !!finnhubKey?.trim() && !(now - lastAdr < ADR_EVERY_MS);
		if (adrDue) {
			const { quotes, failed } = await fetchQuotes(EU_ADRS, finnhubKey!.trim(), euGap);
			inputs.alertQuotes = [...(inputs.alertQuotes ?? []), ...quotes];
			say(`ntfy: ${quotes.length} de ${EU_ADRS.length} ADR europeos${failed.length ? ` (sin dato: ${failed.join(', ')})` : ''}`);
		}
		let log: NotifyLog;
		if (!previous) {
			log = baselineLog(inputs, now);
			say(`ntfy: sin historial (ni en caché ni publicado); ${log.entries.length} avisos posibles se dan por vistos`);
			// Un único aviso de prueba, para confirmar que el tema y la app están bien configurados.
			const { status } = await post(secret, HELLO(now));
			const ok = status !== null && status >= 200 && status < 300;
			log.entries.push({ k: 'hello', t: minute(now), s: ok ? 'sent' : 'failed', p: 3 });
			say(`ntfy · aviso de prueba: ${ok ? 'enviado' : 'no enviado'} (${status ?? 'sin respuesta'})`);
		} else {
			log = trim(previous, now);
			const { send, skipped, updates } = pickAlerts(inputs, log, now, [...RULES, ...userRules(req)]);
			for (const fn of updates) fn(log);
			for (const alert of send) {
				const { status, error } = await post(secret, alert);
				const ok = status !== null && status >= 200 && status < 300;
				log.entries.push({ k: alert.id, t: minute(now), s: ok ? 'sent' : 'failed', p: alert.level });
				// Enviado o no, ya no se vuelve a intentar.
				alert.commit?.(log);
				if (ok) say(`ntfy · P${alert.level} ${alert.id}: enviado (${status})`);
				else if (status !== null) say(`ntfy · P${alert.level} ${alert.id}: ${status}, se descarta`);
				else say(`ntfy · P${alert.level} ${alert.id}: sin respuesta (${error}), se descarta`);
			}
			if (skipped.length) say(`ntfy: ${skipped.length} avisos no caben en los cupos de hoy`);
			if (!send.length && !skipped.length) say('ntfy: nada que avisar');
			if (api && repo) await closeRequests(api, repo, req, log, say);
		}
		if (adrDue) log.last[ADR_KEY] = new Date(now).toISOString();
		const file = (data: NotifyLog) => JSON.stringify({ name: 'notify-log', fetchedAt: new Date(now).toISOString(), data }) + '\n';
		await mkdir(dir, { recursive: true });
		await writeFile(`${dir}/notify-log.json`, file(publicLog(log)));
		// La copia entera, para la caché de Actions (no depende de que la web llegue a publicarse).
		if (cache) {
			await mkdir(dirname(cache), { recursive: true });
			await writeFile(cache, file(log));
		}
		if (cache && users) {
			const path = join(dirname(cache), USERS_FILE);
			const logs = await readUserLogs(path);
			const engine = { pickAlerts, baselineLog, trim, post, hello: HELLO, minute };
			const next = await runUsers(users, inputs, base, logs, now, engine, say);
			await writeFile(path, JSON.stringify({ users: next }) + '\n');
		}
	} catch (error) {
		say(`::warning title=ntfy::${error instanceof Error ? error.message : String(error)}`);
	}
	return lines;
}

// Solo al ejecutarlo directamente (no al importarlo desde los tests).
if (process.argv[1] === fileURLToPath(import.meta.url)) {
	await runNotify({
		topic: process.env.NTFY_TOPIC,
		zone: process.env.ALERT_FUEL_ZONE,
		cache: process.env.NOTIFY_CACHE || undefined,
		finnhubKey: process.env.FINNHUB_API_KEY,
		repo: process.env.GITHUB_REPOSITORY,
		token: process.env.GITHUB_TOKEN
	});
}
