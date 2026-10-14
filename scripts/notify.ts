/// <reference types="node" />
// Avisos al móvil con ntfy (https://ntfy.sh). Lo ejecuta la Action después de `pnpm data` y de
// scripts/issues.ts (solo en el cron, los push a main y a mano; nunca en los PR).
//
// Las reglas (qué se avisa) están en scripts/alerts/rules.ts y los umbrales y cupos, en
// scripts/alerts/config.ts. Este archivo es la mecánica:
// - Cada aviso tiene un id único y estable; un id ya apuntado en el historial no se repite nunca.
// - Niveles P1–P4 con cupo diario (día de Madrid): P1 sin límite, P2 hasta 25, P3 hasta 15, P4 los dos
//   resúmenes. Tope total de 50 al día, solo contra bucles. Si no caben todos, salen primero los de
//   nivel más alto y, a igual nivel, los más recientes. Lo que no cabe no se apunta: se vuelve a mirar
//   en la pasada siguiente (y al día siguiente, si sigue siendo relevante).
// - Se envía a cualquier hora (Sergi usa el «No molestar» del móvil).
// - Si ntfy da 429 o falla, ese aviso se pierde (se apunta como «failed» y no se reintenta).
//
// El historial (static/data/notify-log.json) se publica con la web y se lee de la copia publicada, como
// update.ts. Solo lleva ids, horas, niveles y los valores que se comparan entre pasadas: NUNCA el tema.
// Si no se puede leer (primera vez, o se perdió), todo lo de ahora se apunta como ya visto («baseline»)
// y no se envía nada: así nunca sale una ráfaga de avisos repetidos.
//
// SECRETO: NTFY_TOPIC es la única protección del canal (quien lo sepa puede leer y escribir). No se
// escribe en ningún registro, ni la URL completa, ni la respuesta de ntfy (que lo incluye), ni en el JSON.
//
// Uso: `NTFY_TOPIC=… node scripts/notify.ts`. Sin NTFY_TOPIC, sale sin hacer nada.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { DAILY_TOTAL, KEEP_DAYS, NTFY_PRIORITY, QUOTAS, type Level } from './alerts/config.ts';
import {
	emptyLog,
	FILES,
	madrid,
	RULES,
	SITE,
	type Alert,
	type Inputs,
	type LogEntry,
	type NotifyLog,
	type Rule
} from './alerts/rules.ts';
import { minute } from './history.ts';
import { redact } from './issues.ts';

const LOG_URL = `${SITE}/data/notify-log.json`;
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
		rule.run(d, ctx).map((a): Alert => ({ ...a, type: rule.type, level: rule.level }))
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
	rules: Rule[] = RULES
): { send: Alert[]; skipped: Alert[]; updates: ((log: NotifyLog) => void)[] } {
	const known = new Set(log.entries.map((e) => e.k));
	const { alerts, updates } = candidates(d, log, now, rules);
	const fresh = [...new Map(alerts.filter((a) => !known.has(a.id)).map((a) => [a.id, a])).values()].sort(byImportance);
	const used = usedToday(log, now);
	const send: Alert[] = [];
	const skipped: Alert[] = [];
	for (const a of fresh) {
		if (used.total < DAILY_TOTAL && used.byLevel[a.level] < QUOTAS[a.level]) {
			send.push(a);
			used.total++;
			used.byLevel[a.level]++;
		} else skipped.push(a);
	}
	return { send, skipped, updates };
}

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
		assets: (isObject(data.assets) ? data.assets : {}) as NotifyLog['assets'],
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

/** Aviso de prueba de la primera pasada (sin historial publicado). */
const HELLO = (now: number): Alert => ({
	id: 'hello',
	type: 'hello',
	level: 3,
	title: 'Arc Terminal conectado ✅',
	body: 'Los avisos llegarán por aquí: P1 urgentes, P2 datos y mercados, P3 resto y resúmenes a las 8:05 y a las 22:15.',
	tags: 'white_check_mark',
	click: SITE + '/',
	time: now
});

async function publishedLog(): Promise<NotifyLog | null> {
	try {
		const res = await fetch(LOG_URL, { signal: AbortSignal.timeout(20_000) });
		return res.ok ? parseLog(await res.json()) : null;
	} catch {
		return null;
	}
}

/**
 * Todo el proceso: lee los datos de `dir`, decide, envía y escribe `dir`/notify-log.json. Devuelve las
 * líneas que ha registrado (también van a console.log). No lanza: un fallo se registra saneado.
 */
export async function runNotify({
	topic,
	dir = 'static/data',
	now = Date.now()
}: {
	topic: string | undefined;
	dir?: string;
	now?: number;
}): Promise<string[]> {
	const lines: string[] = [];
	const secret = topic?.trim() ?? '';
	const say = (line: string) => {
		const safe = secret ? scrub(line, secret) : line;
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
		const previous = await publishedLog();
		let log: NotifyLog;
		if (!previous) {
			log = baselineLog(inputs, now);
			say(`ntfy: sin historial publicado; ${log.entries.length} avisos posibles se dan por vistos`);
			// Un único aviso de prueba, para confirmar que el tema y la app están bien configurados.
			const { status } = await post(secret, HELLO(now));
			const ok = status !== null && status >= 200 && status < 300;
			log.entries.push({ k: 'hello', t: minute(now), s: ok ? 'sent' : 'failed', p: 3 });
			say(`ntfy · aviso de prueba: ${ok ? 'enviado' : 'no enviado'} (${status ?? 'sin respuesta'})`);
		} else {
			log = trim(previous, now);
			const { send, skipped, updates } = pickAlerts(inputs, log, now);
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
		}
		await mkdir(dir, { recursive: true });
		const dataset = { name: 'notify-log', fetchedAt: new Date(now).toISOString(), data: log };
		await writeFile(`${dir}/notify-log.json`, JSON.stringify(dataset) + '\n');
	} catch (error) {
		say(`::warning title=ntfy::${error instanceof Error ? error.message : String(error)}`);
	}
	return lines;
}

// Solo al ejecutarlo directamente (no al importarlo desde los tests).
if (process.argv[1] === fileURLToPath(import.meta.url)) await runNotify({ topic: process.env.NTFY_TOPIC });
