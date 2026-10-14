// Reglas de los avisos al móvil. Cada regla es una función pura: recibe los datos de esta pasada
// (static/data/*.json) y el historial publicado, y devuelve sus avisos, cada uno con un id único y estable
// (el mismo hecho da siempre el mismo id, así nunca sale dos veces). Los umbrales están en ./config.ts.
//
// Para añadir un tipo de aviso: escribir su función aquí y ponerla en RULES con su nivel (P1–P4). Si lee
// un JSON nuevo, añadirlo a Inputs y a FILES. Si el JSON aún no existe, la regla no aplica (todo se lee
// de forma tolerante: cualquier campo puede faltar).
import type { SourceHistory, SourceStatus } from '../../src/lib/data.ts';
import { BANKS, decisionTime, MEETINGS } from '../../src/lib/meetings.ts';
import type {
	Chokepoint,
	CryptoData,
	Disaster,
	FedRegData,
	FinnhubData,
	HolidaysData,
	PredictionsData,
	Quake,
	Series,
	SeriesData,
	YieldCurveData
} from '../../src/lib/types.ts';
import { minute } from '../history.ts';
import { decide, downSpan, madridTime } from '../issues.ts';
import {
	ASSETS,
	CRISIS,
	DOWN,
	EARNINGS_WATCH,
	FEDREG,
	GAS,
	IMP_BIG,
	MACRO,
	MARKETS,
	POLYMARKET,
	QUAKE,
	RATES,
	STRAITS,
	SUMMARIES,
	type Asset,
	type Level
} from './config.ts';

export const SITE = 'https://srgicmps.github.io/arc-terminal';
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

// ---------- Tipos ----------

/** Lo que se lee de IMP (scripts/sources/imp.ts, PR #68). Solo lo que hace falta aquí. */
export interface ImpLike {
	current?: { k: string; title: string; sources?: string[]; sections?: string[]; score: number; official?: string }[];
	days?: { date: string; items: { k: string; title: string; sources?: string[]; score: number }[] }[];
}

/** Lo que se espera de un futuro gie.json (llenado de los almacenes de gas de la UE, en %). */
export interface GieLike {
	days?: { date: string; full: number }[];
	eu?: { days?: { date: string; full: number }[] };
}

/** Los datos de esta pasada (static/data/<archivo>.json); cualquiera puede faltar. */
export interface Inputs {
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
}

/** Archivo de static/data de cada entrada de Inputs. */
export const FILES: Record<keyof Inputs, string> = {
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
	holidays: 'holidays'
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
	/** Último valor visto de cada cosa que se compara entre pasadas: periodos macro, tipos, estrechos. */
	last: Record<string, string>;
	/** Último aviso de cada activo de mercado: cuándo, cuánto se movía y de qué dato (para la espera de 4 h). */
	assets: Record<string, { t: string; move: number; obs?: string }>;
	/** Fotos de las probabilidades de Polymarket (una cada 4 h, unas 30 h) para comparar con hace 24 h. */
	poly: Record<string, { t: string; p: Record<string, number> }[]>;
}

export const emptyLog = (): NotifyLog => ({ entries: [], last: {}, assets: {}, poly: {} });

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

/** Lo que devuelve una regla: el aviso sin tipo ni nivel (los pone RULES). */
export type Draft = Omit<Alert, 'type' | 'level'>;

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
	/** De qué dato sale (un día, una hora): el mismo dato no se vuelve a avisar pasada la espera. */
	obs?: string;
}

/** Movimiento de un activo con los datos de esta pasada, o null si no hay datos. */
export function readAsset(asset: Asset, d: Inputs): Reading | null {
	const src = asset.source;
	if (src.kind === 'coin') {
		const c = list(d.crypto?.coins).find((x) => x?.id === src.id);
		return c && typeof c.change24h === 'number' ? { move: c.change24h, value: c.usd } : null;
	}
	if (src.kind === 'quote') {
		const q = list(d.finnhub?.quotes).find((x) => x?.symbol === src.symbol);
		return q && typeof q.changePct === 'number'
			? { move: q.changePct, value: q.price, obs: q.time ?? undefined }
			: null;
	}
	if (src.kind === 'series') {
		const [last, prev] = lastPoints(seriesOf(d[src.file as 'ecb' | 'fred'], src.id));
		return last && prev && prev.v ? { move: (last.v / prev.v - 1) * 100, value: last.v, obs: last.t } : null;
	}
	if (src.kind === 'curve') {
		const i = list(d.uscurve?.tenors).indexOf(src.tenor);
		const days = list(d.uscurve?.days).filter((x) => typeof x?.values?.[i] === 'number');
		const [last, prev] = [days.at(-1), days.at(-2)];
		if (i < 0 || !last || !prev) return null;
		return {
			move: ((last.values[i] as number) - (prev.values[i] as number)) * 100,
			value: last.values[i] as number,
			obs: last.date
		};
	}
	// Prima de riesgo: diferencia con el bono alemán, en los dos últimos periodos que tienen ambos.
	const base = new Map(list(seriesOf(d.ecb, src.base)?.points).map((p) => [p.t, p.v]));
	const both = list(seriesOf(d.ecb, src.id)?.points).filter((p) => typeof base.get(p.t) === 'number');
	const [last, prev] = [both.at(-1), both.at(-2)];
	if (!last || !prev) return null;
	const spread = (p: { t: string; v: number }) => (p.v - base.get(p.t)!) * 100;
	return { move: spread(last) - spread(prev), value: spread(last), obs: last.t };
}

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

/**
 * Mercados con umbrales «B» (config ASSETS). Cada activo espera 4 h entre avisos (y con un dato nuevo),
 * salvo que el movimiento se duplique. Si saltan 3 o más a la vez, van juntos en un solo aviso.
 * Id: mkt:<activo>:<minuto> o mkt:grupo:<minuto>.
 */
export function marketRule(d: Inputs, { now, log }: RuleContext): Draft[] {
	const hits = ASSETS.flatMap((asset) => {
		const r = readAsset(asset, d);
		if (!r || !Number.isFinite(r.move)) return [];
		const big = asset.upOnly ? r.move >= asset.threshold : Math.abs(r.move) >= asset.threshold;
		if (!big) return [];
		const st = log.assets[asset.name];
		const doubled = st && Math.abs(r.move) >= 2 * Math.abs(st.move);
		const waited =
			st && now - Date.parse(st.t) >= MARKETS.waitHours * HOUR && (r.obs === undefined || r.obs !== st.obs);
		return !st || doubled || waited ? [{ asset, r }] : [];
	});
	if (!hits.length) return [];
	const t = minute(now);
	const commitAll = (items: typeof hits) => (l: NotifyLog) => {
		for (const { asset, r } of items) l.assets[asset.name] = { t, move: r.move, obs: r.obs };
	};
	const text = ({ asset, r }: (typeof hits)[number]) => `${asset.name} ${move(r.move, asset.unit)}`;
	if (hits.length >= MARKETS.group) {
		return [
			{
				id: `mkt:grupo:${t}`,
				title: 'Mercados',
				body: hits.map(text).join(', '),
				tags: 'chart_with_downwards_trend',
				click: `${SITE}/ws`,
				time: now,
				commit: commitAll(hits)
			}
		];
	}
	return hits.map((h) => ({
		id: `mkt:${h.asset.name}:${t}`,
		title: `Mercados: ${text(h)}`,
		body: `Movimiento del día (umbral ${move(h.asset.threshold, h.asset.unit).replace('+', '±')}).`,
		tags: h.r.move >= 0 ? 'chart_with_upwards_trend' : 'chart_with_downwards_trend',
		click: `${SITE}/ws`,
		time: now,
		commit: commitAll([h])
	}));
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
	const watch = new Set([...EARNINGS_WATCH.top10, ...EARNINGS_WATCH.mis]);
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

// ---------- P4: resúmenes ----------

const inWindow = (hm: string, w: { from: string; until: string }) => hm >= w.from && hm <= w.until;

/** Agenda de un día: reuniones de bancos centrales, resultados vigilados y festivos. */
function agenda(d: Inputs, date: string): string[] {
	const watch = new Set([...EARNINGS_WATCH.top10, ...EARNINGS_WATCH.mis]);
	const hours: Record<string, string> = { bmo: 'antes de la apertura', amc: 'tras el cierre', dmh: 'en sesión' };
	return [
		...MEETINGS.filter((m) => m.date === date).map(
			(m) => `${BANKS[m.bank].name}: decisión de tipos a las ${decisionTime(m)}`
		),
		...list(d.finnhub?.earnings)
			.filter((e) => e?.date === date && watch.has(e.symbol))
			.map((e) => `Resultados de ${e.symbol}${hours[e.hour] ? ` (${hours[e.hour]})` : ''}`),
		...list(d.holidays?.items)
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
			agenda(d, today).map((l) => `- ${l}`)
		),
		...section('Mercados', markets ? [markets] : [])
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

// ---------- Lista de reglas ----------

/** Todas las reglas, con su nivel. Para añadir una, una entrada más. */
export const RULES: Rule[] = [
	{ type: 'quake', level: 1, run: quakeRule },
	{ type: 'rate', level: 1, run: rateRule },
	{ type: 'imp', level: 1, run: impRule },
	{ type: 'strait', level: 1, run: straitRule },
	{ type: 'macro', level: 2, run: macroRule },
	{ type: 'market', level: 2, run: marketRule },
	{ type: 'fedreg', level: 2, run: fedregRule },
	{ type: 'gas', level: 2, run: gasRule },
	{ type: 'poly', level: 3, run: polyRule },
	{ type: 'earnings', level: 3, run: earningsRule },
	{ type: 'crisis', level: 3, run: crisisRule },
	{ type: 'down', level: 3, run: downRule },
	{ type: 'morning', level: 4, run: morningRule },
	{ type: 'evening', level: 4, run: eveningRule }
];
