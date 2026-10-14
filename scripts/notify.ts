/// <reference types="node" />
// Avisos al móvil con ntfy (https://ntfy.sh). Lo ejecuta la Action después de `pnpm data` y de
// scripts/issues.ts (solo en el cron, los push a main y a mano; nunca en los PR).
//
// Solo lo de máxima importancia. Las reglas están en la lista RULES (de más a menos prioridad):
// - 50 · Terremoto de magnitud ≥ QUAKE_MIN_MAG en las últimas 24 h (USGS, quakes.json).
// - 50 · Fuente caída: cuando issues.ts abriría un issue (mismo decide()/downSpan()).
// - 40 · BCE o Fed: el día de la reunión (src/lib/meetings.ts), en cuanto pasa la hora de la decisión.
// - 30 · IPC de España (INE, serie ipc-es) o de EE. UU. (BLS, serie cpi-us): aparece un mes nuevo.
// - 20 · IMP: un tema con puntuación ≥ IMP_MIN_SCORE (imp.json; si aún no existe, no aplica).
//
// Límites:
// - Cada aviso tiene una clave estable («quake:us7000abcd», «ipc-es:2026-09»…) y no se repite nunca.
// - Como mucho DAILY_LIMIT intentos al día (día de Madrid): red de seguridad contra bucles. Si hay más
//   candidatos que hueco, salen antes los de mayor prioridad (a igual prioridad, el más reciente).
// - Nada de 23:00 a 8:00 (hora de Madrid). Lo que surge en esa franja (o no cabe en el límite) no se
//   descarta ni se apunta: en la siguiente pasada permitida se vuelve a mirar y sale si sigue siendo
//   relevante (terremoto de las últimas 24 h, fuente todavía caída, decisión de hoy, tema todavía arriba
//   en IMP, mes de IPC aún no avisado). Lo que deja de serlo se pierde sin más.
// - Si ntfy da 429 o falla, ese aviso se pierde (se apunta como «failed» y no se reintenta).
//
// El historial (static/data/notify-log.json) se publica con la web y se lee de la copia publicada, como
// update.ts. Solo lleva claves, horas y si se envió: NUNCA el tema de ntfy. Si no se puede leer (primera
// vez, o se perdió), lo de ahora se apunta como ya visto («baseline») y no se envía nada: así nunca sale
// una ráfaga de avisos repetidos.
//
// SECRETO: NTFY_TOPIC es la única protección del canal (quien lo sepa puede leer y escribir). No se
// escribe en ningún registro, ni la URL completa, ni la respuesta de ntfy (que lo incluye), ni en el JSON.
//
// Uso: `NTFY_TOPIC=… node scripts/notify.ts`. Sin NTFY_TOPIC, sale sin hacer nada.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { SourceHistory, SourceStatus } from '../src/lib/data.ts';
import { BANKS, decisionTime, MEETINGS, type Meeting } from '../src/lib/meetings.ts';
import type { Quake, SeriesData } from '../src/lib/types.ts';
import { minute } from './history.ts';
import { decide, downSpan, madridTime, redact } from './issues.ts';

/** Avisos (enviados o fallidos) como mucho en un día de Madrid. Decisión de Sergi. */
export const DAILY_LIMIT = 20;
/** Franja sin avisos, en hora de Madrid: desde las 23:00 hasta las 7:59. */
export const QUIET_FROM = 23;
export const QUIET_TO = 8;
/**
 * Puntuación mínima en IMP (fórmula de scripts/sources/imp.ts): 5 medios distintos dan 2 × (5 − 1) = 8 y
 * la confirmación de una fuente oficial suma 3, así que 11 equivale a «5 medios + oficial». También se
 * llega con más medios, o con varias secciones y muchas horas en portada.
 */
export const IMP_MIN_SCORE = 11;
export const QUAKE_MIN_MAG = 7;
/** Un terremoto deja de ser motivo de aviso a las 24 h. */
const QUAKE_HOURS = 24;
/** Una caída que empezó hace más de esto ya no se avisa (para que no vuelva a salir al recortar el historial). */
const DOWN_DAYS = 3;
/** Días de historial que se guardan. */
export const KEEP_DAYS = 7;

const SITE = 'https://srgicmps.github.io/arc-terminal';
const LOG_URL = `${SITE}/data/notify-log.json`;
const NTFY = 'https://ntfy.sh';
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

// ---------- Tipos ----------

/** Lo que se lee de IMP (scripts/sources/imp.ts en el PR #68). Solo lo que hace falta aquí. */
export interface ImpLike {
	current?: { k: string; title: string; url?: string; sources?: string[]; score: number; official?: string }[];
}

/** Los datos de esta pasada (static/data/*.json); cualquiera puede faltar. */
export interface Inputs {
	imp?: ImpLike;
	ine?: SeriesData;
	bls?: SeriesData;
	quakes?: Quake[];
	status?: SourceStatus[];
	history?: SourceHistory[];
}

export interface Alert {
	/** Tipo de la regla que lo crea (RULES). */
	type: string;
	/** Prioridad numérica de la regla: si no caben todos, salen antes los de mayor valor. */
	rank: number;
	/** Clave estable: el mismo aviso nunca se manda dos veces. */
	key: string;
	title: string;
	body: string;
	/** Prioridad en ntfy (sale de `rank`, ver HIGH). */
	priority: 'high' | 'default';
	/** Etiquetas de ntfy (nombres de emoji). */
	tags: string;
	/** Vista de la web que se abre al tocar el aviso. */
	click: string;
	/** Hora del hecho (ms), para ordenar. */
	time: number;
	/** Serie macro y periodo que este aviso da por avisados. */
	mark?: [string, string];
}

export interface LogEntry {
	k: string;
	/** Hora del intento (ISO, al minuto). */
	t: string;
	/** sent: ntfy respondió 2xx · failed: 429, otro error o sin red · baseline: visto sin enviar. */
	s: 'sent' | 'failed' | 'baseline';
}

export interface NotifyLog {
	entries: LogEntry[];
	/** Último periodo avisado (o visto) de cada serie macro: «ipc-es» → «2026-09». No se recorta. */
	last: Record<string, string>;
}

// ---------- Hora de Madrid ----------

const fmtMadrid = new Intl.DateTimeFormat('en-GB', {
	timeZone: 'Europe/Madrid',
	year: 'numeric',
	month: '2-digit',
	day: '2-digit',
	hour: '2-digit',
	minute: '2-digit',
	hourCycle: 'h23'
});

/** Día («2026-10-14»), hora (0–23) y «HH:MM» en Madrid. Con Intl, el cambio de hora sale solo. */
export function madrid(ms: number): { date: string; hour: number; hm: string } {
	const p = Object.fromEntries(fmtMadrid.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
	return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour), hm: `${p.hour}:${p.minute}` };
}

/** ¿Es franja de silencio (23:00–7:59 en Madrid)? */
export function isQuiet(ms: number): boolean {
	const { hour } = madrid(ms);
	return hour >= QUIET_FROM || hour < QUIET_TO;
}

/** Instante de la decisión de una reunión: 14:15 en Madrid (BCE) o 14:00 en Nueva York (Fed). */
export function decisionAt(m: Meeting): number {
	const hm = decisionTime(m); // hora de Madrid, ya con el desfase de EE. UU. resuelto
	const [h, min] = hm.split(':').map(Number);
	const [y, mo, d] = m.date.split('-').map(Number);
	// Madrid va a UTC+2 o UTC+1: se prueba cuál de los dos da esa hora ese día.
	for (const offset of [2, 1]) {
		const ms = Date.UTC(y, mo - 1, d, h - offset, min);
		if (madrid(ms).hm === hm && madrid(ms).date === m.date) return ms;
	}
	return Date.parse(`${m.date}T${hm}:00Z`);
}

// ---------- Reglas ----------
//
// Cada regla es una entrada de RULES: un tipo, una prioridad numérica (mayor = sale antes si no caben
// todos en el límite diario) y una función que, con los datos de esta pasada, devuelve sus avisos, cada
// uno con su clave estable. Para añadir un tipo nuevo basta con escribir su función y ponerla en RULES
// (y, si lee otro archivo, añadirlo a Inputs y a runNotify).

const num = (v: number, digits = 1) =>
	v.toLocaleString('es-ES', { minimumFractionDigits: digits, maximumFractionDigits: digits });

const MONTHS = [
	'enero',
	'febrero',
	'marzo',
	'abril',
	'mayo',
	'junio',
	'julio',
	'agosto',
	'septiembre',
	'octubre',
	'noviembre',
	'diciembre'
];
const monthName = (period: string) => `${MONTHS[Number(period.slice(5, 7)) - 1] ?? period} de ${period.slice(0, 4)}`;

const PAGER: Record<string, string> = { green: 'verde', yellow: 'amarilla', orange: 'naranja', red: 'roja' };

/** Lo que recibe cada regla además de los datos. */
export interface RuleContext {
	now: number;
	/** Último periodo avisado de cada serie macro. */
	last: Record<string, string>;
	/** La regla apunta aquí las series sin periodo previo: se guarda el de ahora sin avisar. */
	baseline: Record<string, string>;
}

/** Un aviso tal como lo devuelve una regla: candidates() le pone el tipo y las prioridades. */
export type Draft = Omit<Alert, 'type' | 'rank' | 'priority'>;

export interface Rule {
	/** Tipo de aviso. */
	type: string;
	/** Orden cuando no caben todos: mayor primero. Desde HIGH, suena en ntfy con prioridad «high». */
	priority: number;
	run: (d: Inputs, ctx: RuleContext) => Draft[];
}

/** Desde esta prioridad, el aviso sale en ntfy como «high»; por debajo, «default». */
export const HIGH = 50;

/** Terremotos de magnitud ≥ QUAKE_MIN_MAG de las últimas 24 h. Clave: quake:<id del USGS>. */
export function quakeRule(d: Inputs, { now }: RuleContext): Draft[] {
	return (Array.isArray(d.quakes) ? d.quakes : []).flatMap((q) => {
		const t = Date.parse(q?.time);
		if (!q?.id || !(Number(q.mag) >= QUAKE_MIN_MAG) || !Number.isFinite(t) || now - t > QUAKE_HOURS * HOUR) return [];
		const extra = [
			Number.isFinite(q.depth) ? `Profundidad ${Math.round(q.depth)} km.` : '',
			q.tsunami ? 'Aviso de tsunami.' : '',
			q.alert && PAGER[q.alert] ? `Alerta PAGER ${PAGER[q.alert]}.` : ''
		].filter(Boolean);
		return [
			{
				key: `quake:${q.id}`,
				title: `Terremoto M${num(q.mag)} · ${q.place}`,
				body: [`${madridTime(q.time)}.`, ...extra].join(' '),
				tags: 'warning',
				click: `${SITE}/geo`,
				time: t
			}
		];
	});
}

/** Fuente caída: la misma decisión que abre el issue en scripts/issues.ts. Clave: down:<fuente>:<inicio>. */
export function downRule(d: Inputs, { now }: RuleContext): Draft[] {
	const historyOf = new Map((Array.isArray(d.history) ? d.history : []).map((h) => [h?.name, h]));
	return (Array.isArray(d.status) ? d.status : []).flatMap((s) => {
		const history = historyOf.get(s?.name);
		if (!s?.name || decide(s, history, undefined).kind !== 'open') return [];
		const span = downSpan(history)!;
		const since = Date.parse(span.t);
		if (!Number.isFinite(since) || now - since > DOWN_DAYS * DAY) return [];
		return [
			{
				key: `down:${s.name}:${span.t}`,
				title: `Fuente caída: ${s.name}`,
				// Sin el texto del error: puede llevar detalles de la API que no hace falta mandar.
				body: `${s.label}. Sin datos desde ${madridTime(span.t)}, ${span.runs} pasadas seguidas.`,
				tags: 'rotating_light',
				click: `${SITE}/status`,
				time: since
			}
		];
	});
}

/** BCE y Fed: el día de la reunión, desde la hora de la decisión. Clave: bce:<día> o fed:<día>. */
export function bankRule(_d: Inputs, { now }: RuleContext): Draft[] {
	const today = madrid(now).date;
	return MEETINGS.filter((m) => m.date === today && now >= decisionAt(m)).map((m) => {
		const at = decisionAt(m);
		const bank = BANKS[m.bank];
		return {
			key: `${m.bank === 'ecb' ? 'bce' : 'fed'}:${m.date}`,
			title: `${bank.name}: decisión de tipos`,
			body: `El ${bank.long} publica hoy su decisión a las ${decisionTime(m)} (hora de Madrid); rueda de prensa a las ${madrid(at + 30 * 60_000).hm}.${m.sep ? ' Con proyecciones económicas.' : ''}`,
			tags: 'bank',
			click: `${SITE}/eco`,
			time: at
		};
	});
}

/** Series macro que vigila ipcRule: en qué archivo están y cómo se llaman. */
const MACRO = [
	{ id: 'ipc-es', file: 'ine' as const, name: 'IPC de España', source: 'INE' },
	{ id: 'cpi-us', file: 'bls' as const, name: 'IPC de EE. UU.', source: 'BLS' }
];

/** IPC de España (INE) o de EE. UU. (BLS): un mes nuevo respecto al último avisado. Clave: ipc-es:<mes>. */
export function ipcRule(d: Inputs, { now, last, baseline }: RuleContext): Draft[] {
	return MACRO.flatMap((m) => {
		const point = d[m.file]?.series?.find((s) => s.id === m.id)?.points?.at(-1);
		if (!point?.t || typeof point.v !== 'number') return [];
		if (!last[m.id]) {
			baseline[m.id] = point.t;
			return [];
		}
		if (point.t <= last[m.id]) return [];
		const mark: [string, string] = [m.id, point.t];
		return [
			{
				key: `${m.id}:${point.t}`,
				title: `${m.name}: ${num(point.v)} %`,
				body: `Inflación interanual de ${monthName(point.t)} (${m.source}). Visto a las ${madrid(now).hm} (hora de Madrid).`,
				tags: 'chart_with_upwards_trend',
				click: `${SITE}/eco`,
				time: now,
				mark
			}
		];
	});
}

/** IMP: temas con puntuación ≥ IMP_MIN_SCORE. Sin imp.json, no aplica. Clave: imp:<clave del tema>. */
export function impRule(d: Inputs, { now }: RuleContext): Draft[] {
	return (Array.isArray(d.imp?.current) ? d.imp.current : []).flatMap((t) => {
		if (!t?.k || !(Number(t.score) >= IMP_MIN_SCORE)) return [];
		return [
			{
				key: `imp:${t.k}`,
				title: 'Lo más importante',
				body: `${t.title}\n${t.sources?.length ?? 0} medios${t.official ? ` · confirmado por ${t.official}` : ''} · puntuación ${num(t.score)}`,
				tags: 'newspaper',
				click: `${SITE}/imp`,
				time: now
			}
		];
	});
}

/** Todas las reglas. Prioridades de Sergi: terremoto y fuente caída > BCE/Fed > IPC > IMP. */
export const RULES: Rule[] = [
	{ type: 'quake', priority: 50, run: quakeRule },
	{ type: 'down', priority: 50, run: downRule },
	{ type: 'bank', priority: 40, run: bankRule },
	{ type: 'ipc', priority: 30, run: ipcRule },
	{ type: 'imp', priority: 20, run: impRule }
];

/**
 * Todos los avisos que tocarían ahora según los datos, sin mirar lo ya enviado ni los límites.
 * `baseline`: series macro que aún no tienen periodo apuntado (se apunta el de ahora, sin avisar).
 */
export function candidates(
	d: Inputs,
	last: Record<string, string>,
	now: number,
	rules: Rule[] = RULES
): { alerts: Alert[]; baseline: Record<string, string> } {
	const ctx: RuleContext = { now, last, baseline: {} };
	const alerts = rules.flatMap((rule) =>
		rule
			.run(d, ctx)
			.map((a): Alert => ({
				...a,
				type: rule.type,
				rank: rule.priority,
				priority: rule.priority >= HIGH ? 'high' : 'default'
			}))
	);
	return { alerts, baseline: ctx.baseline };
}

/** Orden de salida: mayor prioridad primero; a igual prioridad, el más reciente. */
export const byImportance = (a: Alert, b: Alert) => b.rank - a.rank || b.time - a.time;

/** Intentos (enviados o fallidos) en el mismo día de Madrid que `now`. */
export function usedToday(log: NotifyLog, now: number): number {
	const today = madrid(now).date;
	return log.entries.filter((e) => e.s !== 'baseline' && madrid(Date.parse(e.t)).date === today).length;
}

/**
 * Qué enviar ahora. Quita lo ya apuntado en el historial (enviado, fallido o visto), no envía nada en la
 * franja de 23:00 a 8:00 y respeta el límite diario (primero los de mayor prioridad; a igual prioridad,
 * lo más reciente). `held`: lo que toca pero no sale ahora (silencio o límite); no se apunta y se vuelve
 * a mirar en la siguiente pasada.
 */
export function pickAlerts(
	d: Inputs,
	log: NotifyLog,
	now: number,
	rules: Rule[] = RULES
): { send: Alert[]; held: Alert[]; baseline: Record<string, string> } {
	const known = new Set(log.entries.map((e) => e.k));
	const { alerts, baseline } = candidates(d, log.last, now, rules);
	const fresh = [...new Map(alerts.filter((a) => !known.has(a.key)).map((a) => [a.key, a])).values()].sort(
		byImportance
	);
	if (isQuiet(now)) return { send: [], held: fresh, baseline };
	const room = Math.max(0, DAILY_LIMIT - usedToday(log, now));
	return { send: fresh.slice(0, room), held: fresh.slice(room), baseline };
}

/** Lo que hay ahora, apuntado como ya visto. Para cuando no hay historial: no se envía nada. */
export function baselineLog(d: Inputs, now: number): NotifyLog {
	const { alerts, baseline } = candidates(d, {}, now);
	const last = { ...baseline };
	for (const a of alerts) if (a.mark) last[a.mark[0]] = a.mark[1];
	const t = minute(now);
	return { entries: alerts.map((a): LogEntry => ({ k: a.key, t, s: 'baseline' })), last };
}

/** Deja solo los últimos KEEP_DAYS días de intentos (los periodos macro se quedan). */
export function trim(log: NotifyLog, now: number): NotifyLog {
	const since = now - KEEP_DAYS * DAY;
	return { entries: log.entries.filter((e) => Date.parse(e.t) >= since), last: { ...log.last } };
}

/** Lee un historial publicado; null si no tiene la forma esperada. */
export function parseLog(body: unknown): NotifyLog | null {
	const data = (body as { data?: unknown } | null)?.data as Partial<NotifyLog> | undefined;
	if (!data || !Array.isArray(data.entries)) return null;
	const entries = data.entries.filter(
		(e): e is LogEntry =>
			Boolean(e) &&
			typeof e.k === 'string' &&
			Number.isFinite(Date.parse(e.t)) &&
			['sent', 'failed', 'baseline'].includes(e.s)
	);
	const last = Object.fromEntries(
		Object.entries(data.last && typeof data.last === 'object' ? data.last : {}).filter(([, v]) => typeof v === 'string')
	) as Record<string, string>;
	return { entries, last };
}

// ---------- ntfy ----------

/** Las cabeceras HTTP solo admiten ASCII: el título va en RFC 2047, que ntfy entiende. */
export function encodeHeader(text: string): string {
	return /^[\x20-\x7e]*$/.test(text) ? text : `=?UTF-8?B?${Buffer.from(text, 'utf8').toString('base64')}?=`;
}

/** Envía un aviso. Devuelve el código HTTP, o null si no hubo respuesta. Nunca lanza. */
export async function post(topic: string, alert: Alert): Promise<{ status: number | null; error?: string }> {
	try {
		const res = await fetch(`${NTFY}/${encodeURIComponent(topic)}`, {
			method: 'POST',
			headers: {
				Title: encodeHeader(alert.title),
				Priority: alert.priority,
				Tags: alert.tags,
				Click: alert.click,
				'Content-Type': 'text/plain; charset=utf-8'
			},
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

async function readData<T>(dir: string, name: string): Promise<T | undefined> {
	try {
		return (JSON.parse(await readFile(`${dir}/${name}.json`, 'utf8')) as { data?: T }).data;
	} catch {
		return undefined;
	}
}

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
		const inputs: Inputs = {
			imp: await readData<ImpLike>(dir, 'imp'),
			ine: await readData<SeriesData>(dir, 'ine'),
			bls: await readData<SeriesData>(dir, 'bls'),
			quakes: await readData<Quake[]>(dir, 'quakes'),
			status: await readData<SourceStatus[]>(dir, 'status'),
			history: await readData<SourceHistory[]>(dir, 'status-history')
		};
		const previous = await publishedLog();
		let log: NotifyLog;
		if (!previous) {
			log = baselineLog(inputs, now);
			say(`ntfy: sin historial publicado; ${log.entries.length} avisos posibles se dan por vistos, no se envía nada`);
		} else {
			log = trim(previous, now);
			const { send, held, baseline } = pickAlerts(inputs, log, now);
			log.last = { ...log.last, ...baseline };
			for (const alert of send) {
				const { status, error } = await post(secret, alert);
				const ok = status !== null && status >= 200 && status < 300;
				log.entries.push({ k: alert.key, t: minute(now), s: ok ? 'sent' : 'failed' });
				// Enviado o no, ese periodo ya no se vuelve a intentar.
				if (alert.mark) log.last[alert.mark[0]] = alert.mark[1];
				if (ok) say(`ntfy · ${alert.key}: enviado (${status})`);
				else if (status !== null) say(`ntfy · ${alert.key}: ${status}, se descarta`);
				else say(`ntfy · ${alert.key}: sin respuesta (${error}), se descarta`);
			}
			if (held.length)
				say(`ntfy: ${held.length} avisos esperan (${isQuiet(now) ? 'franja de 23:00 a 8:00' : 'límite diario'})`);
			if (!send.length && !held.length) say('ntfy: nada que avisar');
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
