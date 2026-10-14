// Reglas de los avisos al móvil. Cada regla es una función pura: recibe los datos de esta pasada
// (static/data/*.json) y el historial publicado, y devuelve sus avisos, cada uno con un id único y estable
// (el mismo hecho da siempre el mismo id, así nunca sale dos veces). Los umbrales están en ./config.ts.
//
// Para añadir un tipo de aviso: escribir su función aquí y ponerla en RULES con su nivel (P1–P4). Si lee
// un JSON nuevo, añadirlo a Inputs y a FILES. Si el JSON aún no existe, la regla no aplica (todo se lee
// de forma tolerante: cualquier campo puede faltar).
import { createHash } from 'node:crypto';
import type { SourceHistory, SourceStatus } from '../../src/lib/data.ts';
import type { FuelData, FuelSpainData, FuelStation } from '../../src/lib/fuel.ts';
import { bmeHolidays, nyseHolidays } from '../../src/lib/markets.ts';
import { BANKS, decisionTime, MEETINGS } from '../../src/lib/meetings.ts';
import { lastAndYearAgo, monthlyPayment } from '../../src/lib/mortgage.ts';
import { hourly } from '../../src/lib/power.ts';
import type {
	Chokepoint,
	CryptoData,
	Disaster,
	FedRegData,
	NewsData,
	FinnhubData,
	HolidaysData,
	PowerData,
	PredictionsData,
	Quake,
	Quote,
	Series,
	SeriesData,
	YieldCurveData
} from '../../src/lib/types.ts';
import { minute } from '../history.ts';
import { WORLD_FILES, WORLD_RULES, type WorldInputs } from './world.ts';
import { decide, downSpan, madridTime } from '../issues.ts';
import {
	AI_NEWS,
	ASSETS,
	CONFLICT,
	CRISIS,
	DIESEL,
	DOWN,
	DST,
	EARNINGS_WATCH,
	ELECTIONS,
	FEDREG,
	GAS,
	IMP_BIG,
	LAUNCHES,
	LUZ,
	MACRO,
	MACRO_RISK,
	MARKETS,
	MORTGAGE,
	POLYMARKET,
	QUAKE,
	RATES,
	STOCKS,
	STRAITS,
	SUMMARIES,
	TOMORROW,
	WEEK,
	type Asset,
	type Level
} from './config.ts';

export const SITE = 'https://srgicmps.github.io/arc-terminal';
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

// ---------- Tipos ----------

/** Lo que se lee de IMP (scripts/sources/imp.ts, PR #68). Solo lo que hace falta aquí. */
export interface ImpLike {
	current?: {
		k: string;
		title: string;
		url?: string;
		sources?: string[];
		sections?: string[];
		score: number;
		official?: string;
	}[];
	days?: { date: string; items: { k: string; title: string; url?: string; sources?: string[]; score: number }[] }[];
}

/**
 * Lo que se lee de elections.json (rama claude/elecciones: Election y ElectionsData de src/lib/types.ts).
 * Solo trae las de hoy en adelante.
 */
export interface ElectionsLike {
	items?: { date: string; country: string; iso: string | null; kind: string; name: string; url?: string }[];
}

/** Lo que se lee de launches.json (rama claude/lanzamientos: Launch y LaunchesData de src/lib/launches.ts). */
export interface LaunchesLike {
	launches?: {
		id: string;
		mission: string;
		rocket: string;
		provider: string;
		pad: string;
		location: string;
		/** NET en UTC (ISO 8601). */
		net: string;
		/** false si la fecha es aproximada. */
		precise?: boolean;
		/** «Go», «TBD», «Hold»… */
		status: string;
		url?: string | null;
	}[];
}

/** Lo que se lee de lichess.json (rama claude/chess-extras: Puzzle de src/lib/chess/puzzle.ts). */
export interface PuzzleLike {
	id: string;
	/** Día de Madrid en que se descargó. */
	date: string;
	rating?: number;
	themes?: string[];
	url: string;
}

/** Lo que se espera de un futuro gie.json (llenado de los almacenes de gas de la UE, en %). */
export interface GieLike {
	days?: { date: string; full: number }[];
	eu?: { days?: { date: string; full: number }[] };
}

/**
 * La zona del diésel de Sergi (secreto ALERT_FUEL_ZONE), ya resuelta: un id de provincia («07») o
 * «menorca». Va solo en el texto de los avisos (que llegan a su móvil): nunca en un id, en una clave del
 * historial ni en el registro.
 */
export interface FuelZone {
	id: string;
	name: string;
	/** Gasolineras de la zona (fuel/<id>.json o, en Menorca, fuel.json), para la más barata. */
	stations?: FuelStation[];
}

/** Los datos de esta pasada (static/data/<archivo>.json); cualquiera puede faltar. */
export interface Inputs extends WorldInputs {
	imp?: ImpLike;
	ine?: SeriesData;
	bls?: SeriesData;
	ecb?: SeriesData;
	bis?: SeriesData;
	fred?: SeriesData;
	eurostat?: SeriesData;
	quakes?: Quake[];
	status?: SourceStatus[];
	history?: SourceHistory[];
	portwatch?: Chokepoint[];
	finnhub?: FinnhubData;
	crypto?: CryptoData;
	uscurve?: YieldCurveData;
	fedreg?: FedRegData;
	gie?: GieLike;
	predictions?: PredictionsData;
	reliefweb?: (Disaster & { level?: string })[];
	holidays?: HolidaysData;
	fuelEs?: FuelSpainData;
	fuel?: FuelData;
	power?: PowerData;
	elections?: ElectionsLike;
	newsAi?: NewsData;
	newsTech?: NewsData;
	launches?: LaunchesLike;
	lichess?: PuzzleLike;
	/** alert-quotes.json (PR #132): un Quote por símbolo de ALERT_TICKERS que tenga cotización. */
	alertQuotes?: Quote[];
	/** No es un archivo: la pone notify.ts a partir del secreto. */
	zone?: FuelZone;
}

/** Archivo de static/data de cada entrada de Inputs. */
export const FILES: Record<Exclude<keyof Inputs, 'zone'>, string> = {
	imp: 'imp',
	ine: 'ine',
	bls: 'bls',
	ecb: 'ecb',
	bis: 'bis',
	fred: 'fred',
	eurostat: 'eurostat',
	quakes: 'quakes',
	status: 'status',
	history: 'status-history',
	portwatch: 'portwatch',
	finnhub: 'finnhub',
	crypto: 'crypto',
	uscurve: 'uscurve',
	fedreg: 'fedreg',
	gie: 'gie',
	predictions: 'predictions',
	reliefweb: 'reliefweb',
	holidays: 'holidays',
	fuelEs: 'fuel-es',
	fuel: 'fuel',
	power: 'power',
	elections: 'elections',
	newsAi: 'news-ai',
	newsTech: 'news-tech',
	launches: 'launches',
	lichess: 'lichess',
	alertQuotes: 'alert-quotes',
	...WORLD_FILES
};

export interface LogEntry {
	/** Id del aviso. */
	k: string;
	/** Hora del intento (ISO, al minuto). */
	t: string;
	/** sent: ntfy respondió 2xx · failed: 429, otro error o sin red · baseline: visto sin enviar. */
	s: 'sent' | 'failed' | 'baseline';
	/** Nivel (para los cupos). */
	p?: Level;
}

/** Historial publicado (static/data/notify-log.json). Nunca lleva el tema de ntfy. */
export interface NotifyLog {
	entries: LogEntry[];
	/**
	 * Último valor visto de cada cosa que se compara entre pasadas: periodos macro, tipos, estrechos y, para
	 * mercados y valores seguidos, «día|cierre de referencia|precio del último aviso» (mkt:<activo>, stock:<símbolo>).
	 */
	last: Record<string, string>;
	/** Fotos de las probabilidades de Polymarket (una cada 4 h, unas 30 h) para comparar con hace 24 h. */
	poly: Record<string, { t: string; p: Record<string, number> }[]>;
}

export const emptyLog = (): NotifyLog => ({ entries: [], last: {}, poly: {} });

export interface Alert {
	/** Id único y estable. */
	id: string;
	type: string;
	level: Level;
	title: string;
	body: string;
	/** Etiquetas de ntfy (nombres de emoji). */
	tags: string;
	/** Vista de la web que se abre al tocar el aviso. */
	click: string;
	/** Hora del hecho (ms): a igual nivel, sale antes el más reciente. */
	time: number;
	/** Cuerpo en Markdown (cabecera X-Markdown). */
	markdown?: boolean;
	/** Cambios en el historial cuando el aviso se intenta (enviado o fallido: no se reintenta). */
	commit?: (log: NotifyLog) => void;
}

/**
 * Lo que devuelve una regla: el aviso sin tipo (lo pone RULES). El nivel también lo pone RULES, salvo que
 * la regla lo decida aviso a aviso (conflictos: P1 o P2).
 */
export type Draft = Omit<Alert, 'type' | 'level'> & { level?: Level };

export interface RuleContext {
	now: number;
	/** Día de hoy en Madrid. */
	today: string;
	/** Historial publicado (solo lectura). */
	log: NotifyLog;
	/** Cambios en el historial que se guardan siempre, se envíe algo o no (primeras lecturas, fotos…). */
	update: (change: (log: NotifyLog) => void) => void;
}

export interface Rule {
	type: string;
	level: Level;
	run: (d: Inputs, ctx: RuleContext) => Draft[];
}

// ---------- Ayudantes ----------

const fmtMadrid = new Intl.DateTimeFormat('en-GB', {
	timeZone: 'Europe/Madrid',
	year: 'numeric',
	month: '2-digit',
	day: '2-digit',
	hour: '2-digit',
	minute: '2-digit',
	hourCycle: 'h23'
});

/** Día («2026-10-14») y hora («08:05») en Madrid. Con Intl, el cambio de hora sale solo. */
export function madrid(ms: number): { date: string; hm: string } {
	const p = Object.fromEntries(fmtMadrid.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
	return { date: `${p.year}-${p.month}-${p.day}`, hm: `${p.hour}:${p.minute}` };
}

/** «2026-10-14» + n días de calendario. */
export function addDays(date: string, n: number): string {
	const [y, m, d] = date.split('-').map(Number);
	return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

const list = <T>(v: T[] | undefined | null): T[] => (Array.isArray(v) ? v : []);

/** 2,9 · 1.234,5 (con el formato de España). */
export const num = (v: number, digits = 1) =>
	v.toLocaleString('es-ES', { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** +1,2 · −0,7 (con el signo menos tipográfico). */
export const signed = (v: number, digits = 1) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${num(Math.abs(v), digits)}`;

/** Un movimiento: «−4,1 %» o «+9 pb». */
export const move = (v: number, unit: '%' | 'pb') =>
	unit === 'pb' ? `${signed(Math.round(v), 0)} pb` : `${signed(v)} %`;

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

/** «2026-09» → «septiembre de 2026» · «2026-Q2» → «2.º trimestre de 2026». */
export function periodName(t: string): string {
	const q = /^(\d{4})-Q(\d)$/.exec(t);
	if (q) return `${q[2]}.º trimestre de ${q[1]}`;
	const m = /^(\d{4})-(\d{2})/.exec(t);
	return m ? `${MONTHS[Number(m[2]) - 1]} de ${m[1]}` : t;
}

function seriesOf(data: SeriesData | undefined, id: string): Series | undefined {
	return list(data?.series).find((s) => s?.id === id);
}

function lastPoints(
	s: Series | undefined
): [{ t: string; v: number } | undefined, { t: string; v: number } | undefined] {
	const pts = list(s?.points).filter(
		(p) => p && typeof p.t === 'string' && typeof p.v === 'number' && Number.isFinite(p.v)
	);
	return [pts.at(-1), pts.at(-2)];
}

// ---------- Lectura de mercados ----------

export interface Reading {
	/** Movimiento del día, en % o en pb según el activo. */
	move: number;
	/** Valor actual, para los resúmenes. */
	value?: number;
	/**
	 * Nivel actual y cierre de referencia, en unidades que se pueden comparar con `unit`: el precio para los
	 * activos en % y los puntos básicos para los de pb. Para los escalones (stepMove).
	 */
	level: number;
	ref: number;
	/** De qué dato sale (un día, una hora): marca el día del activo (al cambiar, los escalones se reinician). */
	obs?: string;
}

/** Movimiento de un activo con los datos de esta pasada, o null si no hay datos. */
export function readAsset(asset: Asset, d: Inputs): Reading | null {
	const src = asset.source;
	if (src.kind === 'coin') {
		const c = list(d.crypto?.coins).find((x) => x?.id === src.id);
		return c && typeof c.change24h === 'number' && okPrice(c.usd)
			? { move: c.change24h, value: c.usd, level: c.usd, ref: c.usd / (1 + c.change24h / 100) }
			: null;
	}
	if (src.kind === 'quote') {
		const q = list(d.finnhub?.quotes).find((x) => x?.symbol === src.symbol);
		return q && typeof q.changePct === 'number' && okPrice(q.price)
			? {
					move: q.changePct,
					value: q.price,
					level: q.price,
					ref: okPrice(q.prevClose) ? q.prevClose : q.price / (1 + q.changePct / 100),
					obs: q.time ?? undefined
				}
			: null;
	}
	if (src.kind === 'series') {
		const [last, prev] = lastPoints(seriesOf(d[src.file as 'ecb' | 'fred'], src.id));
		return last && prev && prev.v
			? { move: (last.v / prev.v - 1) * 100, value: last.v, level: last.v, ref: prev.v, obs: last.t }
			: null;
	}
	if (src.kind === 'curve') {
		const i = list(d.uscurve?.tenors).indexOf(src.tenor);
		const days = list(d.uscurve?.days).filter((x) => typeof x?.values?.[i] === 'number');
		const [last, prev] = [days.at(-1), days.at(-2)];
		if (i < 0 || !last || !prev) return null;
		const [now, before] = [(last.values[i] as number) * 100, (prev.values[i] as number) * 100];
		return { move: now - before, value: last.values[i] as number, level: now, ref: before, obs: last.date };
	}
	// Prima de riesgo: diferencia con el bono alemán, en los dos últimos periodos que tienen ambos.
	const base = new Map(list(seriesOf(d.ecb, src.base)?.points).map((p) => [p.t, p.v]));
	const both = list(seriesOf(d.ecb, src.id)?.points).filter((p) => typeof base.get(p.t) === 'number');
	const [last, prev] = [both.at(-1), both.at(-2)];
	if (!last || !prev) return null;
	const spread = (p: { t: string; v: number }) => (p.v - base.get(p.t)!) * 100;
	return { move: spread(last) - spread(prev), value: spread(last), level: spread(last), ref: spread(prev), obs: last.t };
}

/** Movimiento entre dos niveles de un activo: en % (precios) o en pb (niveles ya en pb). */
export const stepMove = (unit: '%' | 'pb', from: number, to: number) => (unit === '%' ? (to / from - 1) * 100 : to - from);

/** Día de un dato de mercado: el de su fecha («2026-10-14», «2026-09») o su hora en Madrid; si no, hoy. */
export function obsDay(obs: string | undefined, today: string): string {
	if (!obs) return today;
	if (/^\d{4}-\d{2}(-\d{2})?$/.test(obs)) return obs;
	const t = Date.parse(obs);
	return Number.isFinite(t) ? madrid(t).date : today;
}

/**
 * Escalones de mercados y valores seguidos, sin espera. El primer aviso del día sale cuando el movimiento
 * desde el cierre anterior (`move`) pasa el umbral; los siguientes, cuando el nivel se mueve otro umbral
 * desde el del último aviso (guardado en log.last[key] como «día|referencia|nivel»), suba o baje. Al cambiar
 * de día se reinicia. `since`: el movimiento desde el último aviso (null si es el primero del día).
 */
export function stepHit(
	log: NotifyLog,
	key: string,
	day: string,
	r: { move: number; level: number },
	unit: '%' | 'pb',
	threshold: number,
	upOnly = false
): { since: number | null } | null {
	const [lastDay, , lastLevel] = (log.last[key] ?? '').split('|');
	const prev = Number(lastLevel);
	const known = lastDay === day && Boolean(lastLevel) && Number.isFinite(prev) && (unit === 'pb' || prev !== 0);
	const since = known ? stepMove(unit, prev, r.level) : null;
	const m = since ?? r.move;
	if (!Number.isFinite(m)) return null;
	return (upOnly ? m >= threshold : Math.abs(m) >= threshold) ? { since } : null;
}

/** Lo que se guarda tras un aviso de escalón. */
export const stepState = (day: string, r: { ref: number; level: number }) => `${day}|${r.ref}|${r.level}`;

// ---------- P1 ----------

/** Terremoto M7+ (o M6+ con aviso de tsunami) de las últimas 24 h. Id: quake:<id del USGS>. */
export function quakeRule(d: Inputs, { now }: RuleContext): Draft[] {
	return list(d.quakes).flatMap((q) => {
		const t = Date.parse(q?.time);
		const mag = Number(q?.mag);
		const strong = mag >= QUAKE.mag || (mag >= QUAKE.magTsunami && Boolean(q?.tsunami));
		if (!q?.id || !strong || !Number.isFinite(t) || now - t > QUAKE.hours * HOUR) return [];
		const extra = [
			Number.isFinite(q.depth) ? `Profundidad ${Math.round(q.depth)} km.` : '',
			q.tsunami ? 'Aviso de tsunami.' : ''
		].filter(Boolean);
		return [
			{
				id: `quake:${q.id}`,
				title: `Terremoto M${num(mag)} · ${q.place}`,
				body: [`${madridTime(q.time)}.`, ...extra].join(' '),
				tags: 'warning',
				click: `${SITE}/geo`,
				time: t
			}
		];
	});
}

/**
 * Cambio de tipos del BCE (ecb.json), la Fed, el BoE o el BoJ (bis.json): el último valor es distinto del
 * apuntado. La primera vez solo se apunta. Id: rate:<serie>:<periodo>:<valor>.
 */
export function rateRule(d: Inputs, { now, log, update }: RuleContext): Draft[] {
	return RATES.flatMap((r) => {
		const [last] = lastPoints(seriesOf(d[r.file], r.id));
		if (!last) return [];
		const key = `rate:${r.id}`;
		const before = log.last[key];
		if (before === undefined) {
			update((l) => void (l.last[key] = String(last.v)));
			return [];
		}
		if (String(last.v) === before) return [];
		const diff = (last.v - Number(before)) * 100;
		return [
			{
				id: `rate:${r.id}:${last.t}:${last.v}`,
				title: `${r.bank} ${diff > 0 ? 'sube' : 'baja'} tipos: ${num(last.v, 2)} %`,
				body: `${r.name[0].toUpperCase()}${r.name.slice(1)}: de ${num(Number(before), 2)} % a ${num(last.v, 2)} % (${signed(Math.round(diff), 0)} pb).`,
				tags: 'bank',
				click: `${SITE}/eco`,
				time: now,
				commit: (l) => void (l.last[key] = String(last.v))
			}
		];
	});
}

/** IMP: tema con 8 o más medios en 3 o más secciones. Sin imp.json no aplica. Id: imp:<clave del tema>. */
export function impRule(d: Inputs, { now }: RuleContext): Draft[] {
	return list(d.imp?.current).flatMap((t) => {
		const media = list(t?.sources).length;
		const sections = list(t?.sections).length;
		if (!t?.k || media < IMP_BIG.media || sections < IMP_BIG.sections) return [];
		// Los conflictos los avisa conflictRule (P1, «⚠ Escalada»): no se repiten aquí.
		if (CONFLICT.words.test(t.title ?? '')) return [];
		return [
			{
				id: `imp:${t.k}`,
				title: 'Lo más importante',
				body: `${t.title}\n${media} medios en ${sections} secciones${t.official ? ` · confirmado por ${t.official}` : ''}.`,
				tags: 'newspaper',
				click: `${SITE}/imp`,
				time: now
			}
		];
	});
}

/**
 * Estrecho clave con la media de tránsitos de los últimos 7 días más de un 50 % por debajo de la de la
 * semana anterior (PortWatch da medias de 7 días: spark[-8] es la de hace una semana). Avisa al entrar
 * en la caída; para volver a avisar, el estrecho tiene que recuperarse antes. Id: strait:<id>:<día>.
 */
export function straitRule(d: Inputs, { now, log, update }: RuleContext): Draft[] {
	return list(d.portwatch).flatMap((c) => {
		if (!c?.id || !STRAITS.names.includes(c.name)) return [];
		const spark = list(c.spark);
		const ref = spark.length >= 8 ? spark.at(-8)! : NaN;
		const key = `strait:${c.id}`;
		const low = ref > 0 && c.avg7 < (1 - STRAITS.drop) * ref;
		if (!low) {
			if (log.last[key]) update((l) => void delete l.last[key]);
			return [];
		}
		if (log.last[key] === 'low') return [];
		const pct = (c.avg7 / ref - 1) * 100;
		return [
			{
				id: `strait:${c.id}:${c.last}`,
				title: `${c.name}: tránsitos ${signed(pct, 0)} %`,
				body: `Media de 7 días: ${num(c.avg7)} buques al día, frente a ${num(ref)} la semana anterior (IMF PortWatch, datos hasta el ${c.last}).`,
				tags: 'ship',
				click: `${SITE}/geo`,
				time: now,
				commit: (l) => void (l.last[key] = 'low')
			}
		];
	});
}

/** El tema de IMP es «grande»: IMP_BIG medios y secciones. */
const impBig = (t: { sources?: string[]; sections?: string[] }) =>
	list(t.sources).length >= IMP_BIG.media && list(t.sections).length >= IMP_BIG.sections;

/**
 * Conflictos (P1/P2): un tema de IMP cuyo título habla de ataques, guerra, OTAN… P1 si es «grande» (IMP_BIG;
 * entonces impRule no lo repite) y P2 con 5 medios o más. Por tema (la k de IMP), un aviso cada 12 h, salvo
 * que pase de P2 a P1. Id: conflict:<k>:<minuto>.
 */
export function conflictRule(d: Inputs, { now, log }: RuleContext): Draft[] {
	const t0 = minute(now);
	return list(d.imp?.current).flatMap((t): Draft[] => {
		if (!t?.k || !CONFLICT.words.test(t.title ?? '')) return [];
		const media = list(t.sources).length;
		const level: Level | null = impBig(t) ? 1 : media >= CONFLICT.media ? 2 : null;
		if (!level) return [];
		const key = `conflict:${t.k}`;
		const [at, before] = (log.last[key] ?? '').split('|');
		const recent = Boolean(at) && now - Date.parse(at) < CONFLICT.waitHours * HOUR;
		if (recent && !(level === 1 && before === '2')) return [];
		const sections = list(t.sections).map((x) => x.toUpperCase());
		return [
			{
				id: `${key}:${t0}`,
				level,
				title: '⚠ Escalada',
				body: [`${t.title} · ${media} medios${sections.length ? ` · ${sections.join('/')}` : ''}`, t.url]
					.filter(Boolean)
					.join('\n'),
				tags: 'conflicto',
				click: t.url || `${SITE}/geo`,
				time: now,
				commit: (l) => void (l.last[key] = `${t0}|${level}`)
			}
		];
	});
}

// ---------- P2 ----------

/** Dato macro nuevo: valor, el anterior y la diferencia. La primera vez solo se apunta. Id: macro:<serie>:<periodo>. */
export function macroRule(d: Inputs, { now, log, update }: RuleContext): Draft[] {
	return MACRO.flatMap((m) => {
		const [last, prev] = lastPoints(seriesOf(d[m.file], m.id));
		if (!last) return [];
		const key = `macro:${m.id}`;
		const before = log.last[key];
		if (before === undefined) {
			update((l) => void (l.last[key] = last.t));
			return [];
		}
		if (last.t <= before) return [];
		if (m.id === 'euribor-12m') {
			return [
				{
					id: `macro:${m.id}:${last.t}`,
					title: `${m.name}: ${num(last.v, 2)} %`,
					body: euriborText(seriesOf(d[m.file], m.id)) ?? `${periodName(last.t)} (${m.source}).`,
					tags: 'house',
					click: `${SITE}/eco`,
					time: now,
					commit: (l) => void (l.last[key] = last.t)
				}
			];
		}
		const jobs = m.unit !== '%';
		const value = jobs ? `${signed(last.v, 0)} ${m.unit}` : `${num(last.v)} %`;
		const previous = prev ? (jobs ? `${signed(prev.v, 0)} ${m.unit}` : `${num(prev.v)} %`) : null;
		const diff = prev && !jobs ? ` (${signed((last.v - prev.v) * 100, 0)} pb)` : '';
		return [
			{
				id: `macro:${m.id}:${last.t}`,
				title: `${m.name}: ${value}`,
				body: `${periodName(last.t)} (${m.source}).${previous ? ` Anterior: ${previous}${diff}.` : ''}`,
				tags: 'chart_with_upwards_trend',
				click: `${SITE}/eco`,
				time: now,
				commit: (l) => void (l.last[key] = last.t)
			}
		];
	});
}

/** Cuota mensual de la hipoteca tipo (config MORTGAGE) con un euríbor dado, en euros. */
export const typicalPayment = (euribor: number) =>
	monthlyPayment(MORTGAGE.capital, MORTGAGE.years, euribor + MORTGAGE.spread);

/**
 * Texto del aviso del euríbor: el último dato frente al mes anterior y al de hace un año, y la cuota de la
 * hipoteca tipo con los dos (sistema francés, src/lib/mortgage.ts). null si la serie no tiene datos.
 * «Euríbor de septiembre: 2,21 % (−0,05 frente a agosto · −0,93 frente a hace un año). Hipoteca tipo de
 * 150.000 € a 25 años: 712 €/mes (−75 € frente a hace un año).»
 */
export function euriborText(s: Series | undefined): string | null {
	const [last, prev] = lastPoints(s);
	if (!last) return null;
	const month = (t: string) => MONTHS[Number(t.slice(5, 7)) - 1] ?? t;
	const year = lastAndYearAgo(s)?.before ?? null;
	const vs = [
		prev ? `${signed(last.v - prev.v, 2)} frente a ${month(prev.t)}` : '',
		year ? `${signed(last.v - year.v, 2)} frente a hace un año` : ''
	].filter(Boolean);
	const pay = typicalPayment(last.v);
	const payBefore = year ? typicalPayment(year.v) : null;
	const loan = `Hipoteca tipo de ${num(MORTGAGE.capital, 0)} € a ${MORTGAGE.years} años`;
	const mortgage =
		pay === null
			? ''
			: ` ${loan}: ${num(pay, 0)} €/mes${payBefore === null ? '' : ` (${signed(Math.round(pay) - Math.round(payBefore), 0)} € frente a hace un año)`}.`;
	return `Euríbor de ${month(last.t)}: ${num(last.v, 2)} %${vs.length ? ` (${vs.join(' · ')})` : ''}.${mortgage}`;
}

/**
 * Mercados con umbrales «B» (config ASSETS), por escalones y sin espera: el primer aviso del día de cada
 * activo sale al pasar el umbral desde el cierre anterior; los siguientes, cada vez que se mueve otro umbral
 * desde el último aviso, suba o baje (las primas, solo al subir). Si saltan 3 o más a la vez, van juntos en
 * un solo aviso. Id: mkt:<activo>:<minuto> o mkt:grupo:<minuto>.
 */
export function marketRule(d: Inputs, { now, today, log }: RuleContext): Draft[] {
	const hits = ASSETS.flatMap((asset) => {
		const r = readAsset(asset, d);
		if (!r || !Number.isFinite(r.move)) return [];
		const day = obsDay(r.obs, today);
		const key = `mkt:${asset.name}`;
		const hit = stepHit(log, key, day, r, asset.unit, asset.threshold, asset.upOnly);
		return hit ? [{ asset, r, day, key, since: hit.since }] : [];
	});
	if (!hits.length) return [];
	type Hit = (typeof hits)[number];
	const t = minute(now);
	const commitAll = (items: Hit[]) => (l: NotifyLog) => {
		for (const h of items) l.last[h.key] = stepState(h.day, h.r);
	};
	const text = ({ asset, r }: Hit) => `${asset.name} ${move(r.move, asset.unit)}`;
	const since = (h: Hit) => (h.since === null ? '' : `${move(h.since, h.asset.unit)} desde el último aviso`);
	if (hits.length >= MARKETS.group) {
		return [
			{
				id: `mkt:grupo:${t}`,
				title: 'Mercados',
				body: hits.map((h) => text(h) + (h.since === null ? '' : ` (${since(h)})`)).join(', '),
				tags: 'chart_with_downwards_trend',
				click: `${SITE}/ws`,
				time: now,
				commit: commitAll(hits)
			}
		];
	}
	return hits.map((h) => {
		// El umbral tal cual está en config (1,25 %, 7,5 pb), sin redondear.
		const value = h.asset.threshold.toLocaleString('es-ES', { maximumFractionDigits: 2 });
		const step = `${h.asset.upOnly ? '+' : '±'}${value} ${h.asset.unit}`;
		return {
			id: `mkt:${h.asset.name}:${t}`,
			title: `Mercados: ${text(h)}`,
			body: `Movimiento del día${h.since === null ? '' : `; ${since(h)}`} (escalón ${step}).`,
			tags: (h.since ?? h.r.move) >= 0 ? 'chart_with_upwards_trend' : 'chart_with_downwards_trend',
			click: `${SITE}/ws`,
			time: now,
			commit: commitAll([h])
		};
	});
}

/**
 * Sanciones o aranceles amplios nuevos de EE. UU. (Federal Register de hoy): uno al día, el más relevante
 * (documento presidencial, palabra clave en el título). Id: fedreg:<día>.
 */
export function fedregRule(d: Inputs, { now, today }: RuleContext): Draft[] {
	const docs = [
		...list(d.fedreg?.presidential).map((doc) => ({ doc, presidential: true })),
		...list(d.fedreg?.rules).map((doc) => ({ doc, presidential: false }))
	]
		.filter(({ doc }) => doc?.date === today && FEDREG.test(`${doc.title} ${doc.abstract ?? ''}`))
		.map((x) => ({ ...x, score: (x.presidential ? 2 : 0) + (FEDREG.test(x.doc.title) ? 1 : 0) }))
		.sort((a, b) => b.score - a.score);
	const best = docs[0];
	if (!best) return [];
	return [
		{
			id: `fedreg:${today}`,
			title: 'EE. UU.: sanciones o aranceles',
			body: `${best.doc.title}${best.doc.agencies?.length ? ` (${best.doc.agencies[0]})` : ''}.`,
			tags: 'scales',
			click: `${SITE}/usgov`,
			time: now
		}
	];
}

/** Gas de la UE (gie.json, cuando exista): baja 1 punto o más en un día, o cruza el 90, 80 o 50 %. Id: gas:<día>. */
export function gasRule(d: Inputs, { now }: RuleContext): Draft[] {
	const days = list(d.gie?.days ?? d.gie?.eu?.days).filter(
		(x) => x && typeof x.date === 'string' && Number.isFinite(x.full)
	);
	const [cur, prev] = [days.at(-1), days.at(-2)];
	if (!cur || !prev) return [];
	const drop = prev.full - cur.full;
	const crossed = GAS.levels.find((l) => (prev.full >= l && cur.full < l) || (prev.full < l && cur.full >= l));
	if (drop < GAS.drop && crossed === undefined) return [];
	return [
		{
			id: `gas:${cur.date}`,
			title: `Gas UE: almacenes al ${num(cur.full)} %`,
			body: `${signed(cur.full - prev.full)} puntos en un día${crossed !== undefined ? `; cruza el ${crossed} %` : ''} (GIE, ${cur.date}).`,
			tags: 'fire',
			click: `${SITE}/eco`,
			time: now
		}
	];
}

// ---------- Elecciones ----------

/** Sin tildes y en minúsculas, para comparar nombres de países con titulares. */
const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Elección del G20 o de la UE (los mismos países que isMajor de src/lib/elections.ts). */
export const majorElection = (iso: string | null | undefined) =>
	!!iso && (ELECTIONS.g20.includes(iso.toUpperCase()) || ELECTIONS.eu.includes(iso.toUpperCase()));

const regionEs = new Intl.DisplayNames(['es'], { type: 'region' });
const regionEn = new Intl.DisplayNames(['en'], { type: 'region' });

/** Otros nombres con los que salen algunos países en los titulares. */
const ALIASES: Record<string, string[]> = {
	US: ['EE. UU.', 'EE.UU.', 'EEUU', 'Estados Unidos', 'US', 'U.S.', 'USA', 'America'],
	GB: ['Reino Unido', 'UK', 'Britain', 'British'],
	KR: ['Corea del Sur', 'South Korea'],
	CZ: ['Chequia', 'República Checa', 'Czech'],
	NL: ['Países Bajos', 'Holanda', 'Netherlands', 'Dutch']
};

/** ¿El titular nombra al país (en español o en inglés)? Las siglas cortas, con las mayúsculas exactas. */
export function namesCountry(title: string, iso: string, country: string): boolean {
	// Intl devuelve el propio código si no conoce el país: ese no vale como nombre.
	const intl = [regionEs.of(iso), regionEn.of(iso)].filter((n) => n !== iso);
	const names = [country, ...intl, ...(ALIASES[iso] ?? [])].filter((n): n is string => !!n);
	const has = (text: string, name: string) =>
		new RegExp(`(^|[^\\p{L}])${escapeRe(name)}($|[^\\p{L}])`, 'u').test(text);
	return names.some((n) => (n.length <= 4 ? has(title, n) : has(fold(title), fold(n))));
}

const KIND_NAME: Record<string, string> = {
	general: 'elecciones generales',
	presidential: 'elecciones presidenciales',
	referendum: 'referéndum'
};

/** «Elecciones federales de Alemania de 2025» → «elecciones federales». */
export function electionName(e: { name: string; country: string; kind: string }): string {
	let n = String(e.name ?? '')
		.trim()
		.replace(/\s+(de\s+)?\d{4}$/i, '');
	n = n.replace(new RegExp(`\\s+(de|en)\\s+(la\\s+|el\\s+|los\\s+)?${escapeRe(e.country)}$`, 'i'), '');
	if (!n || fold(n) === fold(e.country) || /\d{4}/.test(n)) return KIND_NAME[e.kind] ?? 'elecciones';
	return n[0].toLowerCase() + n.slice(1);
}

/**
 * Elecciones del G20 y la UE (elections.json, P2). El día de la votación, desde las 8:00 de Madrid: «🗳 Hoy
 * vota Alemania: elecciones federales». Id: vote:<país>:<día>. Y el resultado: un tema de IMP de ese día o
 * del siguiente que nombre al país y hable de ganar o de resultados, con 5 medios o más. Como elections.json
 * solo trae las de hoy en adelante, la votación se apunta en el historial (vote:<país> = día) para
 * reconocer el resultado al día siguiente. Id: vote-result:<país>:<día>.
 */
export function electionRule(d: Inputs, { now, today, log, update }: RuleContext): Draft[] {
	const yesterday = addDays(today, -1);
	const out: Draft[] = [];
	// Votaciones de hoy o de ayer: las apuntadas y las de elections.json.
	const votes = new Map<string, { iso: string; date: string; country: string }>();
	for (const [k, date] of Object.entries(log.last)) {
		const iso = /^vote:([A-Z]{2})$/.exec(k)?.[1];
		if (!iso) continue;
		if (date < yesterday) update((l) => void delete l.last[k]);
		else votes.set(`${iso}|${date}`, { iso, date, country: regionEs.of(iso) ?? iso });
	}
	for (const e of list(d.elections?.items)) {
		if (!e?.iso || !majorElection(e.iso) || (e.date !== today && e.date !== yesterday)) continue;
		const iso = e.iso.toUpperCase();
		votes.set(`${iso}|${e.date}`, { iso, date: e.date, country: e.country });
		if (log.last[`vote:${iso}`] !== e.date) update((l) => void (l.last[`vote:${iso}`] = e.date));
		if (e.date === today && madrid(now).hm >= ELECTIONS.from) {
			out.push({
				id: `vote:${iso}:${e.date}`,
				title: `🗳 Hoy vota ${e.country}: ${electionName(e)}`,
				body: `${e.name} (Wikidata).`,
				tags: 'elecciones',
				click: `${SITE}/geo`,
				time: now
			});
		}
	}
	for (const v of votes.values()) {
		const days = [v.date, addDays(v.date, 1)];
		if (!days.includes(today)) continue;
		const topics = [
			...list(d.imp?.current),
			...list(d.imp?.days)
				.filter((x) => days.includes(x?.date))
				.flatMap((x) => list(x.items))
		];
		const hit = topics.find(
			(t) =>
				t?.title &&
				list(t.sources).length >= ELECTIONS.media &&
				ELECTIONS.result.test(t.title) &&
				namesCountry(t.title, v.iso, v.country)
		);
		if (!hit) continue;
		out.push({
			id: `vote-result:${v.iso}:${v.date}`,
			title: `🗳 Resultados en ${v.country}`,
			body: [`${hit.title} · ${list(hit.sources).length} medios`, hit.url].filter(Boolean).join('\n'),
			tags: 'elecciones',
			click: hit.url || `${SITE}/geo`,
			time: now
		});
	}
	return out;
}

// ---------- IA ----------

/** Enlace comparable: sin protocolo, «www.», parámetros ni barra final. */
const plainUrl = (u: string) =>
	u
		.trim()
		.toLowerCase()
		.replace(/^https?:\/\/(www\.)?/, '')
		.replace(/[?#].*$/, '')
		.replace(/\/+$/, '');
const fingerprint = (s: string) => createHash('sha1').update(s).digest('base64url').slice(0, 10);

/**
 * IA (P2): un grupo de titulares de news-ai.json o news-tech.json (scripts/cluster.ts junta la misma noticia
 * de varios medios en `also`: el «+N medios» de la web) con 3 medios o más, que nombra a un laboratorio
 * (OpenAI, Google, Anthropic…) y un lanzamiento. Un aviso por grupo (se apuntan todos sus enlaces, así no
 * se repite aunque cambie el titular principal) y como mucho 3 al día. Id: ai:<huella del enlace>.
 */
export function aiRule(d: Inputs, { now, today, log, update }: RuleContext): Draft[] {
	// Enlaces ya avisados (ai:u:<huella> = día): se olvidan a los 3 días.
	for (const [k, day] of Object.entries(log.last)) {
		if (k.startsWith('ai:u:') && day < addDays(today, -3)) update((l) => void delete l.last[k]);
	}
	const usedToday = log.entries.filter(
		(e) => e.k.startsWith('ai:') && e.s !== 'baseline' && madrid(Date.parse(e.t)).date === today
	).length;
	let room = AI_NEWS.perDay - usedToday;
	const taken = new Set<string>();
	const out: Draft[] = [];
	const groups = [...list(d.newsAi?.items), ...list(d.newsTech?.items)]
		.filter((it) => it?.title && it.url)
		.map((it) => ({
			it,
			media: new Set([it.source, ...list(it.also).map((a) => a?.source)].filter(Boolean)).size
		}))
		.sort((a, b) => b.media - a.media);
	for (const { it, media } of groups) {
		if (room <= 0) break;
		if (media < AI_NEWS.media || !AI_NEWS.labs.test(it.title) || !AI_NEWS.launch.test(it.title)) continue;
		const urls = [it.url, ...list(it.also).map((a) => a?.url)]
			.filter(Boolean)
			.map((u) => fingerprint(plainUrl(u)));
		// La misma noticia sale en IA y en Tecnología, o ya se avisó con otro titular principal.
		if (urls.some((u) => taken.has(u) || log.last[`ai:u:${u}`])) continue;
		for (const u of urls) taken.add(u);
		room--;
		out.push({
			id: `ai:${urls[0]}`,
			title: `IA: ${it.title}`,
			body: `${it.source} y ${media - 1} medios más.\n${it.url}`,
			tags: 'robot',
			click: it.url,
			time: Date.parse(it.time ?? '') || now,
			commit: (l) => {
				for (const u of urls) l.last[`ai:u:${u}`] = today;
			}
		});
	}
	return out;
}

// ---------- Valores seguidos ----------

/** Nombre legible de un símbolo de Finnhub («LMT» → «Lockheed Martin»). */
export const stockName = (symbol: string) => STOCKS.names[symbol] ?? symbol;

/**
 * Valores seguidos (alert-quotes.json, P2), por escalones como los mercados y sin espera: el primer aviso
 * del día sale con una variación de ±3 % (STOCKS.threshold) o más desde el cierre anterior; los siguientes,
 * cada vez que el precio se mueve otro 3 % desde el último aviso, suba o baje. El día es el de la cotización
 * (así el viernes no se repite el sábado). Si 3 o más se mueven a la vez, van juntos. Solo cuentan los
 * símbolos que traiga el archivo (con el plan gratuito de Finnhub, los europeos no vienen).
 * Id: stock:<símbolo>:<minuto> o stock:grupo:<minuto>.
 */
export function stockRule(d: Inputs, { now, today, log }: RuleContext): Draft[] {
	const hits = list(d.alertQuotes).flatMap((q) => {
		const pct = q?.changePct;
		if (!q?.symbol || typeof pct !== 'number' || !Number.isFinite(pct) || !okPrice(q.price)) return [];
		const r = { move: pct, level: q.price, ref: okPrice(q.prevClose) ? q.prevClose : q.price / (1 + pct / 100) };
		const day = obsDay(q.time ?? undefined, today);
		const key = `stock:${q.symbol}`;
		const hit = stepHit(log, key, day, r, '%', STOCKS.threshold);
		return hit ? [{ q, pct, r, day, key, since: hit.since }] : [];
	});
	if (!hits.length) return [];
	type Hit = (typeof hits)[number];
	const commitAll = (items: Hit[]) => (l: NotifyLog) => {
		for (const h of items) l.last[h.key] = stepState(h.day, h.r);
	};
	const text = (h: Hit) => `${stockName(h.q.symbol)} ${signed(h.pct)} %`;
	const since = (h: Hit) => (h.since === null ? '' : `${signed(h.since)} % desde el último aviso`);
	const t0 = minute(now);
	if (hits.length >= STOCKS.group) {
		return [
			{
				id: `stock:grupo:${t0}`,
				title: 'Valores seguidos',
				body: hits.map((h) => text(h) + (h.since === null ? '' : ` (${since(h)})`)).join(', '),
				tags: hits.filter((h) => h.pct < 0).length > hits.length / 2 ? 'chart_with_downwards_trend' : 'chart_with_upwards_trend',
				click: `${SITE}/ws`,
				time: now,
				commit: commitAll(hits)
			}
		];
	}
	return hits.map((h) => ({
		id: `stock:${h.q.symbol}:${t0}`,
		title: text(h),
		body: `Variación del día${h.since === null ? '' : `; ${since(h)}`} (escalón ±${num(STOCKS.threshold, 0)} %). Cotiza a ${num(h.q.price, 2)}${
			typeof h.q.prevClose === 'number' ? `; cierre anterior, ${num(h.q.prevClose, 2)}` : ''
		}.`,
		tags: (h.since ?? h.pct) >= 0 ? 'chart_with_upwards_trend' : 'chart_with_downwards_trend',
		// La ficha de la web es de TradingView: los símbolos de EE. UU. de Finnhub valen tal cual.
		click: h.q.symbol.includes('.') ? `${SITE}/ws` : `${SITE}/s?sym=${encodeURIComponent(h.q.symbol)}`,
		time: now,
		commit: commitAll([h])
	}));
}

// ---------- Riesgo macro (fred.json) ----------

/** Puntos con fecha diaria («2026-10-14») y valor numérico, en orden. */
function dailyPoints(s: Series | undefined): { t: string; v: number }[] {
	return list(s?.points).filter(
		(p) => p && typeof p.t === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.t) && typeof p.v === 'number' && Number.isFinite(p.v)
	);
}

/**
 * Diferencial high yield de EE. UU. ('hy-us', en %: 3,10 = 310 pb). Avisa si el último dato supera en
 * MACRO_RISK.HY_JUMP_PB pb o más al de hace 7 días naturales (o al último anterior, por los festivos).
 * Id: hy:<fecha del último dato>. En log.last['hy'] queda la fecha avisada: no se repite hasta que el cambio
 * semanal baje del umbral (entonces se borra) o pasen HY_REPEAT_DAYS días.
 */
export function hyRule(d: Inputs, { now, log, update }: RuleContext): Draft[] {
	const pts = dailyPoints(seriesOf(d.fred, 'hy-us'));
	const last = pts.at(-1);
	const ref = last && pts.filter((p) => p.t <= addDays(last.t, -7)).at(-1);
	if (!last || !ref) return [];
	// En pb, redondeado a centésimas para que 3,60 − 3,10 no quede en 49,999…
	const jump = Math.round((last.v - ref.v) * 10_000) / 100;
	const key = 'hy';
	const before = log.last[key];
	if (jump < MACRO_RISK.HY_JUMP_PB) {
		if (before !== undefined) update((l) => void delete l.last[key]);
		return [];
	}
	if (before !== undefined && last.t < addDays(before, MACRO_RISK.HY_REPEAT_DAYS)) return [];
	return [
		{
			id: `hy:${last.t}`,
			title: `Crédito: el diferencial high yield sube ${num(jump, 0)} pb en una semana (hasta ${num(last.v, 2)} %)`,
			body: `De ${num(ref.v, 2)} % (${ref.t}) a ${num(last.v, 2)} % (${last.t}). Umbral: +${num(MACRO_RISK.HY_JUMP_PB, 0)} pb en 7 días. Fuente: ICE BofA vía FRED.`,
			tags: 'chart_with_upwards_trend',
			click: `${SITE}/eco`,
			time: now,
			commit: (l) => void (l.last[key] = last.t)
		}
	];
}

/**
 * Liquidez neta de la Fed ('fed-net-liquidity', semanal, en millones de $). Avisa si el último dato cae
 * MACRO_RISK.LIQUIDITY_DROP_M o más frente al de 4 datos antes (4 semanas). Id: liquidity:<fecha del último
 * dato>, uno por dato semanal nuevo.
 */
export function liquidityRule(d: Inputs, { now }: RuleContext): Draft[] {
	const pts = dailyPoints(seriesOf(d.fred, 'fed-net-liquidity'));
	const [last, ref] = [pts.at(-1), pts.at(-5)];
	if (!last || !ref || pts.length < 5) return [];
	const drop = last.v - ref.v;
	if (drop > -MACRO_RISK.LIQUIDITY_DROP_M) return [];
	return [
		{
			id: `liquidity:${last.t}`,
			title: `Liquidez de la Fed: ${signed(drop, 0)} M$ en 4 semanas (${num(last.v / 1e6, 2)} billones)`,
			body: `De ${num(ref.v, 0)} M$ (${ref.t}) a ${num(last.v, 0)} M$ (${last.t}). Fuente: Fed vía FRED.`,
			tags: 'chart_with_downwards_trend',
			click: `${SITE}/eco`,
			time: now
		}
	];
}

// ---------- Diésel ----------

/** Un día de precio medio del diésel (€/L). */
export interface DayValue {
	date: string;
	v: number;
}

const okPrice = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;

/**
 * Historial diario del diésel: «es» es la media de España (fuel-es.json); «zona», la de la zona de Sergi
 * (su provincia en fuel-es.json o, si es Menorca, fuel.json). En orden de fecha.
 */
export function dieselSeries(d: Inputs, scope: 'es' | 'zona'): DayValue[] {
	let points: { date: unknown; v: unknown }[] = [];
	if (scope === 'es') {
		points = list(d.fuelEs?.history).map((h) => ({ date: h?.date, v: h?.avg?.diesel }));
	} else if (d.zone?.id === 'menorca') {
		points = list(d.fuel?.history).map((h) => ({ date: h?.date, v: h?.avg?.diesel }));
	} else if (d.zone) {
		const id = d.zone.id;
		points = list(d.fuelEs?.history).map((h) => ({ date: h?.date, v: h?.provinces?.[id]?.diesel }));
	}
	return points
		.filter((p): p is DayValue => typeof p.date === 'string' && okPrice(p.v))
		.sort((a, b) => a.date.localeCompare(b.date));
}

const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
const between = <T extends { date: string }>(s: T[], from: string, to: string) =>
	s.filter((p) => p.date >= from && p.date <= to);

/** 1,412 €/L */
export const euroL = (v: number) => `${num(v, 3)} €/L`;
/** +3,4 cts (de una diferencia en €/L). */
export const cts = (diffEuro: number) => `${signed(diffEuro * 100)} cts`;

/** Diferencia con el dato de hace 7 días (o el más cercano de los 3 anteriores a ese), en €/L. */
export function weekChange(s: DayValue[]): number | null {
	const last = s.at(-1);
	if (!last) return null;
	const ref = between(s, addDays(last.date, -10), addDays(last.date, -7)).at(-1);
	return ref ? last.v - ref.v : null;
}

/** España y, si la hay, la zona, cada una con su historial. */
const scopes = (d: Inputs) =>
	[
		{ scope: 'es' as const, name: 'España' },
		...(d.zone ? [{ scope: 'zona' as const, name: d.zone.name }] : [])
	].map((x) => ({ ...x, s: dieselSeries(d, x.scope) }));

const FUEL_SOURCE = 'Ministerio para la Transición Ecológica';

/** «14 de octubre» */
const dayMonth = (date: string) => `${Number(date.slice(8, 10))} de ${MONTHS[Number(date.slice(5, 7)) - 1]}`;

/**
 * a) Diésel, cambio diario: en cuanto llega un dato nuevo, si el precio medio cambia frente al día anterior
 * con dato (de cualquier cantidad; lo mínimo que se ve es 0,1 cts/L), en España y en la zona. Sin espera:
 * el id lleva la fecha del dato, así que cada dato avisa una sola vez. Id: diesel:day:<es|zona>:<día>.
 */
export function dieselDayRule(d: Inputs, { now }: RuleContext): Draft[] {
	return scopes(d).flatMap(({ scope, name, s }) => {
		const [prev, cur] = [s.at(-2), s.at(-1)];
		if (!prev || !cur) return [];
		const diff = cur.v - prev.v;
		// Lo que no llega a 0,1 cts (la última cifra de 1,412 €/L) se ve como «sin cambios».
		if (Math.round(diff * 1000) === 0) return [];
		const vs = prev.date === addDays(cur.date, -1) ? 'frente a ayer' : `frente al ${dayMonth(prev.date)}`;
		const week = weekChange(s);
		const weekText = week === null ? '' : ` · ${signed(week * 100)} en 7 días`;
		return [
			{
				id: `diesel:day:${scope}:${cur.date}`,
				title: `Diésel en ${name}: ${euroL(cur.v)} (${cts(diff)} ${vs}${weekText})`,
				body: `Precio medio del ${dayMonth(cur.date)}; el anterior, ${euroL(prev.v)} (${FUEL_SOURCE}).`,
				tags: 'fuelpump',
				click: `${SITE}/fuel`,
				time: now
			}
		];
	});
}

/** «julio» o, si es de otro año, «julio de 2025». */
function monthOf(date: string, ref: string): string {
	const name = MONTHS[Number(date.slice(5, 7)) - 1];
	return date.slice(0, 4) === ref.slice(0, 4) ? name : `${name} de ${date.slice(0, 4)}`;
}

/**
 * b) Diésel en su mínimo o máximo de 90 días (con al menos 90 días de historial), en España y en la zona.
 * «Desde» es el mes de la última vez que estuvo así de bajo (o de alto). Sin espera: avisa con cada dato
 * nuevo que lo cumpla (el id lleva la fecha del dato). Id: diesel:<low|high>:<es|zona>:<día>.
 */
export function dieselExtremeRule(d: Inputs, { now }: RuleContext): Draft[] {
	return scopes(d).flatMap(({ scope, name, s }) => {
		const cur = s.at(-1);
		if (!cur) return [];
		const from = addDays(cur.date, -(DIESEL.extremeDays - 1));
		if (s[0].date > from) return [];
		const window = s.filter((p) => p.date >= from && p.date < cur.date).map((p) => p.v);
		if (!window.length) return [];
		const kind = cur.v < Math.min(...window) ? 'low' : cur.v > Math.max(...window) ? 'high' : null;
		if (!kind) return [];
		const low = kind === 'low';
		const since = s.filter((p) => p.date < from && (low ? p.v <= cur.v : p.v >= cur.v)).at(-1);
		const span = Math.round((Date.parse(cur.date) - Date.parse(s[0].date)) / DAY) + 1;
		const when = since ? `desde ${monthOf(since.date, cur.date)}` : `de los últimos ${span} días`;
		return [
			{
				id: `diesel:${kind}:${scope}:${cur.date}`,
				title: `Diésel en ${name}, en su ${low ? 'mínimo' : 'máximo'} ${when}: ${euroL(cur.v)}`,
				body: `Precio medio del ${dayMonth(cur.date)} (${FUEL_SOURCE}).`,
				tags: 'fuelpump',
				click: `${SITE}/fuel`,
				time: now
			}
		];
	});
}

/**
 * c) La zona se separa ±5 cts/L o más de la media de España (el último día que tienen las dos). Sin espera:
 * avisa con cada dato nuevo que lo cumpla (el id lleva la fecha del dato). Id: diesel:gap:<día>.
 */
export function dieselGapRule(d: Inputs, { now }: RuleContext): Draft[] {
	if (!d.zone) return [];
	const es = new Map(dieselSeries(d, 'es').map((p) => [p.date, p.v]));
	const cur = dieselSeries(d, 'zona')
		.filter((p) => es.has(p.date))
		.at(-1);
	if (!cur) return [];
	const spain = es.get(cur.date)!;
	const gap = cur.v - spain;
	if (Math.abs(gap) * 100 < DIESEL.gapCts) return [];
	return [
		{
			id: `diesel:gap:${cur.date}`,
			title: `Diésel en ${d.zone.name}: ${cts(gap)} ${gap > 0 ? 'por encima' : 'por debajo'} de España`,
			body: `${euroL(cur.v)} frente a ${euroL(spain)} de media en España (${FUEL_SOURCE}).`,
			tags: 'fuelpump',
			click: `${SITE}/fuel`,
			time: now
		}
	];
}

/** La gasolinera con el diésel más barato de la zona, si hay datos. */
export function cheapestDiesel(zone: FuelZone | undefined): FuelStation | null {
	const withPrice = list(zone?.stations).filter((st) => okPrice(st?.prices?.diesel));
	return withPrice.sort((a, b) => a.prices.diesel! - b.prices.diesel!)[0] ?? null;
}

/** Líneas del diésel para los resúmenes: España, la zona (si la hay) y, si se pide, su gasolinera más barata. */
export function dieselLines(d: Inputs, cheapest = true): string[] {
	const lines = scopes(d).flatMap(({ scope, name, s }) => {
		const cur = s.at(-1);
		if (!cur) return [];
		const change = weekChange(s);
		const label = scope === 'es' ? 'Diésel' : `Diésel en ${name}`;
		return [`${label}: ${euroL(cur.v)}${change === null ? '' : ` (${cts(change)} en 7 días)`}`];
	});
	const best = cheapest ? cheapestDiesel(d.zone) : null;
	if (best) lines.push(`Más barato en ${d.zone!.name}: ${best.name} (${best.town}), ${euroL(best.prices.diesel!)}`);
	return lines;
}

// ---------- P3 ----------

/**
 * Polymarket: mercado con mucho volumen cuya probabilidad cambia 15 puntos o más frente a hace unas 24 h
 * (la foto guardada entre 20 y 28 h atrás). Una foto cada 4 h. Id: poly:<mercado>:<día>.
 */
export function polyRule(d: Inputs, { now, today, log, update }: RuleContext): Draft[] {
	const markets = [
		...new Map(
			[...list(d.predictions?.geopolitics), ...list(d.predictions?.economy), ...list(d.predictions?.rates)]
				.filter((p) => p?.id && Number(p.volume24h) >= POLYMARKET.minVolume)
				.map((p) => [p.id, p])
		).values()
	]
		.sort((a, b) => b.volume24h - a.volume24h)
		.slice(0, POLYMARKET.maxTracked);
	const t = minute(now);
	update((l) => {
		const keep: NotifyLog['poly'] = {};
		for (const p of markets) {
			const snaps = list(l.poly[p.id]).filter((s) => now - Date.parse(s.t) <= 30 * HOUR);
			if (!snaps.length || now - Date.parse(snaps.at(-1)!.t) >= 4 * HOUR) {
				snaps.push({ t, p: Object.fromEntries(list(p.outcomes).map((o) => [o.label, o.p])) });
			}
			keep[p.id] = snaps;
		}
		l.poly = keep;
	});
	return markets.flatMap((p) => {
		const ref = list(log.poly[p.id])
			.map((s) => ({ s, age: now - Date.parse(s.t) }))
			.filter(({ age }) => age >= 20 * HOUR && age <= 28 * HOUR)
			.sort((a, b) => Math.abs(a.age - DAY) - Math.abs(b.age - DAY))[0]?.s;
		if (!ref) return [];
		const changes = list(p.outcomes)
			.filter((o) => typeof ref.p[o.label] === 'number')
			.map((o) => ({ label: o.label, p: o.p, diff: o.p - ref.p[o.label] }))
			.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
		const top = changes[0];
		if (!top || Math.abs(top.diff) < POLYMARKET.change) return [];
		return [
			{
				id: `poly:${p.id}:${today}`,
				title: `Polymarket: ${signed(top.diff * 100, 0)} puntos`,
				body: `${p.title} · «${top.label}»: ${num(top.p * 100, 0)} % (hace 24 h, ${num(ref.p[top.label] * 100, 0)} %). Son precios de mercado, no pronósticos.`,
				tags: 'crystal_ball',
				click: `${SITE}/geo`,
				time: now
			}
		];
	});
}

/**
 * Resultados de las 10 más grandes o de MIS (Finnhub) el día que presentan, en cuanto hay BPA real.
 * Id: earn:<símbolo>:<día>.
 */
export function earningsRule(d: Inputs, { now, today }: RuleContext): Draft[] {
	const watch = new Set(Object.values(EARNINGS_WATCH).flat());
	return list(d.finnhub?.earnings).flatMap((e) => {
		if (e?.date !== today || !watch.has(e.symbol) || typeof e.epsActual !== 'number') return [];
		const est = typeof e.epsEstimate === 'number' ? ` (previsto ${num(e.epsEstimate, 2)})` : '';
		const rev =
			typeof e.revenueActual === 'number'
				? ` · ingresos ${num(e.revenueActual / 1e9)} mil M$${typeof e.revenueEstimate === 'number' ? ` (previstos ${num(e.revenueEstimate / 1e9)})` : ''}`
				: '';
		return [
			{
				id: `earn:${e.symbol}:${e.date}`,
				title: `Resultados de ${e.symbol}`,
				body: `BPA ${num(e.epsActual, 2)} $${est}${rev}.`,
				tags: 'moneybag',
				click: `${SITE}/cal`,
				time: now
			}
		];
	});
}

/** Crisis nueva de nivel alto (ReliefWeb, si llega a dar el nivel en `level`). Id: crisis:<id>. */
export function crisisRule(d: Inputs, { now }: RuleContext): Draft[] {
	return list(d.reliefweb).flatMap((c) => {
		const t = Date.parse(c?.date ?? '');
		if (!c?.id || !CRISIS.levels.includes(String(c.level ?? '').toLowerCase())) return [];
		if (!Number.isFinite(t) || now - t > CRISIS.hours * HOUR) return [];
		return [
			{
				id: `crisis:${c.id}`,
				title: 'Crisis nueva',
				body: `${c.name} (ReliefWeb).`,
				tags: 'sos',
				click: `${SITE}/geo`,
				time: t
			}
		];
	});
}

/** Fuente caída: la misma decisión que abre el issue en scripts/issues.ts (3 pasadas). Id: down:<fuente>:<inicio>. */
export function downRule(d: Inputs, { now }: RuleContext): Draft[] {
	const historyOf = new Map(list(d.history).map((h) => [h?.name, h]));
	return list(d.status).flatMap((s) => {
		const history = historyOf.get(s?.name);
		if (!s?.name || decide(s, history, undefined).kind !== 'open') return [];
		const span = downSpan(history)!;
		const since = Date.parse(span.t);
		if (!Number.isFinite(since) || now - since > DOWN.days * DAY) return [];
		return [
			{
				id: `down:${s.name}:${span.t}`,
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

// ---------- P3: vida diaria ----------

/** Precio de la luz de un día (€/kWh): media y hora más barata, del PVPC por horas o del historial. */
export function powerDay(d: Inputs, date: string): { avg: number; cheap?: { hour: number; kwh: number } } | null {
	const hours = hourly(list(d.power?.pvpc).filter((p) => typeof p?.t === 'string' && Number.isFinite(p.v))).filter(
		(h) => h.day === date
	);
	if (hours.length >= 23) {
		const cheap = [...hours].sort((a, b) => a.kwh - b.kwh)[0];
		return { avg: mean(hours.map((h) => h.kwh)), cheap: { hour: cheap.hour, kwh: cheap.kwh } };
	}
	const day = list(d.power?.history).find((h) => h?.date === date);
	return day && okPrice(day.avg) ? { avg: day.avg } : null;
}

/** 0,128 €/kWh */
const euroKwh = (v: number) => `${num(v, 3)} €/kWh`;

/**
 * a) La luz de mañana (PVPC, power.json; REE la publica hacia las 20:15): su media, un 30 % o más por debajo
 * o por encima de la media de los 30 días anteriores. El historial lo va guardando la propia web, así que
 * al principio hay menos de 30 días: se usa lo que haya (al menos LUZ.minDays) y el aviso dice cuántos.
 * Id: luz:<mañana>.
 */
export function luzRule(d: Inputs, { now, today }: RuleContext): Draft[] {
	const tomorrow = addDays(today, 1);
	const next = powerDay(d, tomorrow);
	if (!next) return [];
	const ref = list(d.power?.history).filter(
		(h) => h?.date < tomorrow && h.date >= addDays(tomorrow, -LUZ.days) && okPrice(h.avg)
	);
	if (ref.length < LUZ.minDays) return [];
	const base = mean(ref.map((h) => h.avg));
	const pct = (next.avg / base - 1) * 100;
	if (Math.abs(pct) < LUZ.change) return [];
	const span = ref.length >= LUZ.days ? `${LUZ.days} días` : `los últimos ${ref.length} días`;
	const cheap = next.cheap ? ` La hora más barata, las ${next.cheap.hour} h (${euroKwh(next.cheap.kwh)}).` : '';
	return [
		{
			id: `luz:${tomorrow}`,
			title: `Luz de mañana: ${signed(pct, 0)} % (${euroKwh(next.avg)})`,
			body: `Media del PVPC de mañana: ${euroKwh(next.avg)}, frente a ${euroKwh(base)} de media de ${span} (Red Eléctrica).${cheap}`,
			tags: 'bulb',
			click: `${SITE}/luz`,
			time: now
		}
	];
}

const dayOfWeek = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();
const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** «sábado 12 de octubre» */
const dayName = (date: string) =>
	`${WEEKDAYS[dayOfWeek(date)]} ${Number(date.slice(8, 10))} de ${MONTHS[Number(date.slice(5, 7)) - 1]}`;

const holidayLine = (h: { name: string; scope: string }) => `${h.scope === 'IB' ? 'en Baleares' : 'en España'}: ${h.name}`;

/**
 * b) Mañana es festivo (holidays.json, de España o de Baleares) o no abre la bolsa de Nueva York o la de
 * Madrid (festivos calculados en src/lib/markets.ts; los fines de semana no cuentan). A partir de las 19:00
 * de la víspera, en un solo aviso. Id: manana:<mañana>.
 */
export function tomorrowRule(d: Inputs, { now, today }: RuleContext): Draft[] {
	if (!inWindow(madrid(now).hm, TOMORROW)) return [];
	const tomorrow = addDays(today, 1);
	const year = Number(tomorrow.slice(0, 4));
	const holidays = list(d.holidays?.items).filter((h) => h?.date === tomorrow);
	const closed = [
		...nyseHolidays(year).map((h) => ({ ...h, label: 'Nueva York (NYSE)' })),
		...bmeHolidays(year).map((h) => ({ ...h, label: 'Madrid (BME)' }))
	].filter((h) => h.date === tomorrow);
	if (!holidays.length && !closed.length) return [];
	const title = holidays.length
		? `Mañana es festivo: ${holidays[0].name}`
		: `Mañana no abre la bolsa de ${closed.map((c) => c.label).join(' ni la de ')}`;
	const lines = [
		...holidays.map((h) => `Festivo ${holidayLine(h)}.`),
		...closed.map((c) => `Sin bolsa en ${c.label}: ${c.name}.`)
	];
	return [
		{
			id: `manana:${tomorrow}`,
			title,
			body: `${dayName(tomorrow)[0].toUpperCase()}${dayName(tomorrow).slice(1)}. ${lines.join(' ')}`,
			tags: 'calendar',
			click: `${SITE}/cal`,
			time: now
		}
	];
}

/** Último domingo de un mes («2026-10-25»). */
export function lastSunday(year: number, month: number): string {
	const last = new Date(Date.UTC(year, month, 0));
	last.setUTCDate(last.getUTCDate() - last.getUTCDay());
	return last.toISOString().slice(0, 10);
}

/**
 * c) Cambio de hora este fin de semana (último domingo de marzo y de octubre, a la 1:00 UTC), avisado el
 * viernes anterior desde las 10:00. Id: dst:<domingo>.
 */
export function dstRule(_d: Inputs, { now, today }: RuleContext): Draft[] {
	if (dayOfWeek(today) !== 5 || !inWindow(madrid(now).hm, DST)) return [];
	const sunday = addDays(today, 2);
	const year = Number(sunday.slice(0, 4));
	const spring = sunday === lastSunday(year, 3);
	if (!spring && sunday !== lastSunday(year, 10)) return [];
	return [
		{
			id: `dst:${sunday}`,
			title: `Cambio de hora este domingo: ${spring ? 'se adelanta' : 'se atrasa'} una hora`,
			body: spring
				? `La madrugada del ${dayName(sunday)}, a las 2:00 serán las 3:00 (se duerme una hora menos).`
				: `La madrugada del ${dayName(sunday)}, a las 3:00 serán las 2:00 (una hora más de sueño).`,
			tags: 'clock3',
			click: `${SITE}/wx`,
			time: now
		}
	];
}

type Launch = NonNullable<LaunchesLike['launches']>[number];

/** «Starship (vuelo 12)», «Falcon 9 (Crew-12)». */
export function launchName(l: Pick<Launch, 'mission' | 'rocket'>): string {
	const rocket = (l.rocket ?? '').trim();
	const mission = (l.mission ?? '').trim().replace(/\bFlight (\d+)\b/i, 'vuelo $1');
	if (!rocket) return mission;
	const rest = mission.toLowerCase().startsWith(rocket.toLowerCase()) ? mission.slice(rocket.length).trim() : mission;
	return rest ? `${rocket} (${rest})` : rocket;
}

/**
 * Lanzamientos (launches.json, P3): «Go», con hora exacta y el NET entre dentro de 45 y de 75 min (la Action
 * pasa cada 15–30 min, así que sale una vez, hacia una hora antes). Solo tripulados (Launch Library no da
 * el dato en lo que guarda launches.ts: se reconoce por la misión), Starship, Artemis, New Glenn o Ariane 6,
 * o de NASA, ESA, CNSA, ISRO o JAXA. Id: launch:<id>:<NET> (si se retrasa, el NET nuevo es otro aviso).
 */
export function launchRule(d: Inputs, { now }: RuleContext): Draft[] {
	return list(d.launches?.launches).flatMap((l) => {
		const net = Date.parse(l?.net ?? '');
		if (!l?.id || l.status !== 'Go' || l.precise === false || !Number.isFinite(net)) return [];
		const mins = (net - now) / 60_000;
		if (mins < LAUNCHES.fromMin || mins > LAUNCHES.toMin) return [];
		const watched =
			LAUNCHES.crewed.test(l.mission ?? '') ||
			LAUNCHES.types.test(`${l.rocket ?? ''} ${l.mission ?? ''}`) ||
			LAUNCHES.agencies.test(l.provider ?? '');
		if (!watched) return [];
		const place = (l.location ?? '').split(',')[0].trim() || l.pad;
		return [
			{
				id: `launch:${l.id}:${l.net}`,
				title: `🚀 En 1 h: ${launchName(l)}${place ? ` desde ${place}` : ''}, ${madrid(net).hm} hora de Madrid`,
				body: [`${l.provider || 'Lanzamiento'} · Launch Library 2 (The Space Devs).`, l.url].filter(Boolean).join('\n'),
				tags: 'lanzamiento',
				click: l.url || `${SITE}/tech`,
				time: now
			}
		];
	});
}

/** Línea de vida diaria de los resúmenes: diésel, luz de hoy y festivo, si lo es. */
export function dailyLife(d: Inputs, today: string, cheapest: boolean): string[] {
	const luz = powerDay(d, today);
	return [
		...dieselLines(d, cheapest),
		...(luz
			? [
					`Luz hoy: ${euroKwh(luz.avg)} de media${luz.cheap ? `; la hora más barata, las ${luz.cheap.hour} h (${euroKwh(luz.cheap.kwh)})` : ''}`
				]
			: []),
		...list(d.holidays?.items)
			.filter((h) => h?.date === today)
			.map((h) => `Hoy es festivo ${holidayLine(h)}`)
	];
}

// ---------- P4: resúmenes ----------

const inWindow = (hm: string, w: { from: string; until: string }) => hm >= w.from && hm <= w.until;

/** Agenda de un día: reuniones de bancos centrales, resultados vigilados y, si se piden, festivos. */
function agenda(d: Inputs, date: string, holidays = true): string[] {
	const watch = new Set(Object.values(EARNINGS_WATCH).flat());
	const hours: Record<string, string> = { bmo: 'antes de la apertura', amc: 'tras el cierre', dmh: 'en sesión' };
	return [
		...MEETINGS.filter((m) => m.date === date).map(
			(m) => `${BANKS[m.bank].name}: decisión de tipos a las ${decisionTime(m)}`
		),
		...list(d.finnhub?.earnings)
			.filter((e) => e?.date === date && watch.has(e.symbol))
			.map((e) => `Resultados de ${e.symbol}${hours[e.hour] ? ` (${hours[e.hour]})` : ''}`),
		...list(holidays ? d.holidays?.items : [])
			.filter((h) => h?.date === date)
			.map((h) => `Festivo${h.scope === 'IB' ? ' en Baleares' : ' en España'}: ${h.name}`)
	];
}

/** Cifras de los activos que tengan dato, en una línea. */
function figures(d: Inputs, names: string[]): string {
	return ASSETS.filter((a) => names.includes(a.name))
		.flatMap((a) => {
			const r = readAsset(a, d);
			return r && Number.isFinite(r.move) ? [`${a.name} ${move(r.move, a.unit)}`] : [];
		})
		.join(' · ');
}

const section = (title: string, lines: string[]) => (lines.length ? [`**${title}**`, ...lines, ''] : []);

/**
 * Problema del día de Lichess (lichess.json) para «Buenos días», si es de hoy: «♟ Problema del día: mate en
 * 2 · dificultad 1850 → enlace». No es un aviso propio.
 */
export function chessLine(d: Inputs, today: string): string[] {
	const p = d.lichess;
	if (!p?.url || p.date !== today) return [];
	const mate = list(p.themes)
		.map((t) => /^mateIn(\d)$/.exec(t)?.[1])
		.find(Boolean);
	const what = [mate ? `mate en ${mate}` : '', p.rating ? `dificultad ${p.rating}` : ''].filter(Boolean).join(' · ');
	return [`♟ Problema del día${what ? `: ${what}` : ''} → ${p.url}`];
}

/** «Buenos días» a partir de las 8:05 (hora de Madrid), una vez al día. Id: morning:<día>. */
export function morningRule(d: Inputs, { now, today }: RuleContext): Draft[] {
	if (!inWindow(madrid(now).hm, SUMMARIES.morning)) return [];
	const top = list(d.imp?.current)
		.slice(0, 3)
		.map((t, i) => `${i + 1}. ${t.title} (${list(t.sources).length} medios)`);
	const markets = figures(d, ['BTC', 'ETH', 'S&P 500', 'Nasdaq']);
	const body = [
		...section('Lo más importante', top),
		...section(
			'Hoy',
			// El festivo de hoy va en «Vida diaria».
			agenda(d, today, false).map((l) => `- ${l}`)
		),
		...section('Mercados', markets ? [markets] : []),
		...section(
			'Vida diaria',
			dailyLife(d, today, true).map((l) => `- ${l}`)
		),
		...chessLine(d, today)
	];
	return [
		{
			id: `morning:${today}`,
			title: 'Buenos días',
			body: body.join('\n').trim() || 'Sin novedades destacadas.',
			tags: 'sunrise',
			click: `${SITE}/`,
			time: now,
			markdown: true
		}
	];
}

/** «Cierre» a partir de las 22:15 (hora de Madrid), una vez al día. Id: evening:<día>. */
export function eveningRule(d: Inputs, { now, today }: RuleContext): Draft[] {
	if (!inWindow(madrid(now).hm, SUMMARIES.evening)) return [];
	const day = list(d.imp?.days).find((x) => x?.date === today)?.items ?? list(d.imp?.current);
	const top = list(day)
		.slice(0, 3)
		.map((t, i) => `${i + 1}. ${t.title} (${list(t.sources).length} medios)`);
	const markets = figures(d, ['BTC', 'ETH', 'EUR/USD', 'US10Y', 'S&P 500', 'Nasdaq', 'Petróleo WTI']);
	const body = [
		...section('Lo más importante del día', top),
		...section('Cifras del día', markets ? [markets] : []),
		...section(
			'Vida diaria',
			dailyLife(d, today, false).map((l) => `- ${l}`)
		),
		...section(
			'Mañana',
			agenda(d, addDays(today, 1)).map((l) => `- ${l}`)
		)
	];
	return [
		{
			id: `evening:${today}`,
			title: 'Cierre',
			body: body.join('\n').trim() || 'Sin novedades destacadas.',
			tags: 'night_with_stars',
			click: `${SITE}/`,
			time: now,
			markdown: true
		}
	];
}

/**
 * Cambio en una semana de un activo con datos diarios (series del BCE o de FRED, curva del Tesoro): el
 * último dato frente al último de hace 7 días o más. null si no se puede calcular (cripto y cotizaciones
 * solo traen el día; las primas son mensuales).
 */
export function weekMove(asset: Asset, d: Inputs): number | null {
	const src = asset.source;
	const daily = /^\d{4}-\d{2}-\d{2}$/;
	if (src.kind === 'series') {
		const pts = list(seriesOf(d[src.file as 'ecb' | 'fred'], src.id)?.points).filter(
			(p) => daily.test(p?.t) && Number.isFinite(p.v)
		);
		const last = pts.at(-1);
		const ref = last && pts.filter((p) => p.t <= addDays(last.t, -7)).at(-1);
		return last && ref && ref.v ? (last.v / ref.v - 1) * 100 : null;
	}
	if (src.kind === 'curve') {
		const i = list(d.uscurve?.tenors).indexOf(src.tenor);
		if (i < 0) return null;
		const days = list(d.uscurve?.days).filter((x) => daily.test(x?.date) && typeof x.values?.[i] === 'number');
		const last = days.at(-1);
		const ref = last && days.filter((x) => x.date <= addDays(last.date, -7)).at(-1);
		return last && ref ? ((last.values[i] as number) - (ref.values[i] as number)) * 100 : null;
	}
	return null;
}

/**
 * SEMANA (P4), los domingos desde las 19:00 de Madrid: los 5 temas de IMP con más puntuación de los últimos
 * 7 días, el cambio semanal de los activos que se pueden calcular y la agenda de la semana que viene. En
 * Markdown. Id: week:<domingo>.
 */
export function weekRule(d: Inputs, { now, today }: RuleContext): Draft[] {
	if (dayOfWeek(today) !== 0 || !inWindow(madrid(now).hm, SUMMARIES.week)) return [];
	const from = addDays(today, -6);
	const best = new Map<string, { title: string; sources?: string[]; score: number }>();
	for (const day of list(d.imp?.days)) {
		if (!(day?.date >= from && day.date <= today)) continue;
		for (const t of list(day.items)) {
			if (!t?.k || !Number.isFinite(t.score)) continue;
			if (!best.has(t.k) || best.get(t.k)!.score < t.score) best.set(t.k, t);
		}
	}
	const top = [...best.values()]
		.sort((a, b) => b.score - a.score)
		.slice(0, WEEK.top)
		.map((t, i) => `${i + 1}. ${t.title} (${list(t.sources).length} medios)`);
	const markets = ASSETS.flatMap((a) => {
		const m = weekMove(a, d);
		return m === null || !Number.isFinite(m) ? [] : [`${a.name} ${move(m, a.unit)}`];
	}).join(' · ');
	const next = Array.from({ length: 7 }, (_, i) => addDays(today, i + 1)).flatMap((date) =>
		agenda(d, date).map((l) => `- ${dayName(date)[0].toUpperCase()}${dayName(date).slice(1)}: ${l}`)
	);
	const body = [
		...section('Lo más importante de la semana', top),
		...section('Mercados en la semana', markets ? [markets] : []),
		...section('La semana que viene', next)
	];
	return [
		{
			id: `week:${today}`,
			title: 'SEMANA',
			body: body.join('\n').trim() || 'Sin novedades destacadas.',
			tags: 'calendar',
			click: `${SITE}/imp`,
			time: now,
			markdown: true
		}
	];
}

// ---------- Lista de reglas ----------

/** Todas las reglas, con su nivel. Para añadir una, una entrada más. */
export const RULES: Rule[] = [
	{ type: 'quake', level: 1, run: quakeRule },
	{ type: 'rate', level: 1, run: rateRule },
	{ type: 'imp', level: 1, run: impRule },
	{ type: 'strait', level: 1, run: straitRule },
	// P1 o P2 según el tema (el nivel lo pone la regla).
	{ type: 'conflict', level: 1, run: conflictRule },
	{ type: 'macro', level: 2, run: macroRule },
	{ type: 'market', level: 2, run: marketRule },
	{ type: 'fedreg', level: 2, run: fedregRule },
	{ type: 'gas', level: 2, run: gasRule },
	{ type: 'diesel-day', level: 2, run: dieselDayRule },
	{ type: 'diesel-extreme', level: 2, run: dieselExtremeRule },
	{ type: 'diesel-gap', level: 2, run: dieselGapRule },
	{ type: 'election', level: 2, run: electionRule },
	{ type: 'ai', level: 2, run: aiRule },
	{ type: 'stock', level: 2, run: stockRule },
	{ type: 'hy', level: 2, run: hyRule },
	{ type: 'liquidity', level: 2, run: liquidityRule },
	{ type: 'poly', level: 3, run: polyRule },
	{ type: 'earnings', level: 3, run: earningsRule },
	{ type: 'crisis', level: 3, run: crisisRule },
	{ type: 'down', level: 3, run: downRule },
	{ type: 'luz', level: 3, run: luzRule },
	{ type: 'tomorrow', level: 3, run: tomorrowRule },
	{ type: 'dst', level: 3, run: dstRule },
	{ type: 'launch', level: 3, run: launchRule },
	{ type: 'morning', level: 4, run: morningRule },
	{ type: 'evening', level: 4, run: eveningRule },
	{ type: 'week', level: 4, run: weekRule },
	...WORLD_RULES
];
