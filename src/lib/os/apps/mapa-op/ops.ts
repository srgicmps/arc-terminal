// Mapa operacional (herramienta de Arc OS): la lógica, sin DOM. Junta todas las capas de GEO (terremotos, ciclones,
// incendios y volcanes, estrechos, sanciones, espacio aéreo y avisos a barcos) y las de la Sala de control
// (catástrofes de GDACS, cortes de internet, avisos de viaje y conflictos en titulares) en una sola lista de puntos
// con su hora. Aquí también están los filtros por capa y por tiempo, el rango de la línea de tiempo, el histograma
// que va debajo y las cuentas del mapa plano (acercar y mover). Funciones puras, con tests (ops.test.ts).
import { nf } from '../../../format.ts';
import {
	airspacePoints,
	eventPoints,
	maritimePoints,
	quakePoints,
	sanctionPoints,
	stormPoints,
	straitPoints,
	type MapPoint
} from '../../../geo/layers.ts';
import { conflictPoints, gdacsPoints, outagePoints, travelPoints } from '../../../exp/sala.ts';
import { mergeSanctions } from '../../../sanctions.ts';
import type { CzibData } from '../../../czib.ts';
import type { NavWarnData } from '../../../navwarn.ts';
import type {
	AdvisoriesData,
	Chokepoint,
	EuLexDoc,
	GdacsEvent,
	HazardsData,
	IodaOutage,
	NewsItem,
	Quake,
	TradeDoc
} from '../../../types.ts';

export type OpLayer =
	| 'quakes'
	| 'storms'
	| 'events'
	| 'disasters'
	| 'conflict'
	| 'internet'
	| 'maritime'
	| 'airspace'
	| 'travel'
	| 'straits'
	| 'sanctions';

/**
 * Las capas, en el orden de los filtros. `state`: es un estado que dura (un estrecho, un boletín de espacio aéreo),
 * no un suceso: se ve desde que empezó, aunque sea de antes del periodo elegido.
 */
export const OP_LAYERS: readonly { value: OpLayer; label: string; state?: boolean }[] = [
	{ value: 'quakes', label: 'Terremotos' },
	{ value: 'storms', label: 'Ciclones' },
	{ value: 'events', label: 'Incendios y volcanes' },
	{ value: 'disasters', label: 'Catástrofes (GDACS)' },
	{ value: 'conflict', label: 'Conflictos en titulares' },
	{ value: 'internet', label: 'Cortes de internet', state: true },
	{ value: 'maritime', label: 'Avisos a barcos' },
	{ value: 'airspace', label: 'Espacio aéreo', state: true },
	{ value: 'travel', label: 'Avisos de viaje', state: true },
	{ value: 'straits', label: 'Estrechos', state: true },
	{ value: 'sanctions', label: 'Sanciones' }
];

const STATE_LAYERS = new Set<OpLayer>(OP_LAYERS.filter((l) => l.state).map((l) => l.value));
export const isState = (layer: OpLayer) => STATE_LAYERS.has(layer);

export const layerLabel = (layer: OpLayer) => OP_LAYERS.find((l) => l.value === layer)?.label ?? layer;

/** Un punto del mapa operacional: el de GEO con su hora en ms (null si no se sabe), la fuente y más detalle. */
export interface OpPoint extends Omit<MapPoint, 'layer'> {
	layer: OpLayer;
	/** Lo pide el globo (GlobePoint): la hora en ISO. */
	t: string | null;
	/** La misma hora, en ms desde 1970, para filtrar. */
	at: number | null;
	/** Quién lo publica: «USGS», «EASA»… */
	source: string;
	/** Filas de la ficha: [nombre, valor]. */
	detail: [string, string][];
}

/** Los JSON de static/data que lee el mapa (solo su campo `data`). Si falta alguno, esa capa sale vacía. */
export interface OpRaw {
	quakes?: Quake[] | null;
	hazards?: HazardsData | null;
	portwatch?: Chokepoint[] | null;
	sanctions?: TradeDoc[] | null;
	sanctionsUk?: TradeDoc[] | null;
	eurlex?: EuLexDoc[] | null;
	czib?: CzibData | null;
	navwarn?: NavWarnData | null;
	gdacs?: GdacsEvent[] | null;
	ioda?: IodaOutage[] | null;
	advisories?: AdvisoriesData | null;
	news?: NewsItem[] | null;
}

/** Nombre del JSON (static/data/<nombre>.json) de cada campo de OpRaw; las noticias son dos. */
export const OP_FILES = {
	quakes: 'quakes',
	hazards: 'hazards',
	portwatch: 'portwatch',
	sanctions: 'sanctions',
	sanctionsUk: 'sanctions-uk',
	eurlex: 'eurlex',
	czib: 'czib',
	navwarn: 'navwarn',
	gdacs: 'gdacs',
	ioda: 'ioda',
	advisories: 'advisories'
} as const satisfies Record<Exclude<keyof OpRaw, 'news'>, string>;
export const OP_NEWS_FILES = ['news-geo', 'news-world'] as const;

/** Una fecha ISO (o «AAAA-MM-DD», que se lee a las 00:00 UTC) en ms; null si no se puede leer. */
export function parseT(s: string | null | undefined): number | null {
	if (!s) return null;
	const t = Date.parse(s);
	return Number.isFinite(t) ? t : null;
}

const SOURCE: Record<OpLayer, string> = {
	quakes: 'USGS',
	storms: 'NOAA',
	events: 'NASA EONET',
	disasters: 'GDACS',
	conflict: 'Titulares',
	internet: 'IODA',
	maritime: 'NGA (avisos a navegantes)',
	airspace: 'EASA (CZIB)',
	travel: 'Departamento de Estado de EE. UU.',
	straits: 'FMI PortWatch',
	sanctions: 'Federal Register · OFSI · EUR-Lex'
};

const deg = (lat: number, lon: number) =>
	`${nf(Math.abs(lat), 2)}° ${lat >= 0 ? 'N' : 'S'} · ${nf(Math.abs(lon), 2)}° ${lon >= 0 ? 'E' : 'O'}`;

/** Lo que añade cada capa a un punto: su hora y las filas de la ficha, por id del punto de GEO o de la Sala. */
type Extra = Record<string, { t?: string | null; detail?: [string, string][] }>;

function op(points: { id: string; lat: number; lon: number }[], layer: OpLayer, extra: Extra = {}): OpPoint[] {
	return (points as (MapPoint & { t?: string | null; region?: unknown })[]).map(({ region: _r, t: t0, ...p }) => {
		const e = extra[p.id] ?? {};
		const t = e.t !== undefined ? e.t : (t0 ?? null);
		return {
			...p,
			// Cada capa numera los suyos («n-…» son conflictos y avisos a barcos): la capa va delante.
			id: `${layer}:${p.id}`,
			layer,
			t,
			at: parseT(t),
			source: SOURCE[layer],
			detail: [...(e.detail ?? []), ['Posición', deg(p.lat, p.lon)]]
		};
	});
}

const by = <T>(items: T[] | null | undefined, key: (x: T) => string, val: (x: T) => Extra[string]): Extra =>
	Object.fromEntries((items ?? []).map((x) => [key(x), val(x)]));

/** Todos los puntos, de todas las capas. Los ids no se repiten. */
export function buildPoints(d: OpRaw): OpPoint[] {
	const quakes = d.quakes ?? [];
	const storms = d.hazards?.storms ?? [];
	const events = d.hazards?.events ?? [];
	const czib = d.czib?.items ?? [];
	const navwarn = d.navwarn?.items ?? [];
	const trade = mergeSanctions(d.sanctions, d.sanctionsUk, d.eurlex);
	const tradeByUrl = new Map(trade.map((t) => [t.url, t]));
	const sanctions = sanctionPoints(trade);
	// news-geo y news-world comparten muchos titulares: cada noticia (por enlace) sale una sola vez.
	const seenNews = new Set<string>();
	const news = (d.news ?? [])
		.filter((n) => n.time && !seenNews.has(n.url) && !!seenNews.add(n.url))
		.sort((a, b) => b.time!.localeCompare(a.time!))
		.slice(0, 80);

	const all = [
		...op(
			quakePoints(quakes),
			'quakes',
			by(
				quakes,
				(q) => `q-${q.id}`,
				(q) => ({
					t: q.time,
					detail: [
						['Magnitud', nf(q.mag, 1)],
						['Profundidad', `${nf(q.depth, 0)} km`],
						...(q.tsunami ? [['Tsunami', 'Aviso emitido'] as [string, string]] : []),
						...(q.alert ? [['Alerta PAGER', q.alert] as [string, string]] : [])
					]
				})
			)
		),
		...op(
			stormPoints(storms),
			'storms',
			by(
				storms,
				(s) => `s-${s.id}`,
				(s) => ({
					t: s.updated,
					detail: [
						['Tipo', s.classification],
						['Viento', `${nf(s.knots, 0)} nudos`],
						...(s.pressure ? [['Presión', `${nf(s.pressure, 0)} hPa`] as [string, string]] : [])
					]
				})
			)
		),
		...op(
			eventPoints(events),
			'events',
			by(
				events,
				(e) => `e-${e.id}`,
				(e) => ({
					t: e.date,
					detail: [['Tipo', e.category], ...(e.magnitude ? [['Medida', e.magnitude] as [string, string]] : [])]
				})
			)
		),
		...op(
			gdacsPoints(d.gdacs ?? undefined),
			'disasters',
			by(
				d.gdacs,
				(g) => `g-${g.id}`,
				(g) => ({
					detail: [['Gravedad', g.severity], ...(g.from ? [['Desde', g.from.slice(0, 10)] as [string, string]] : [])]
				})
			)
		),
		...op(conflictPoints(news), 'conflict'),
		...op(
			outagePoints(d.ioda ?? undefined),
			'internet',
			by(
				d.ioda,
				(o) => `i-${o.code}`,
				(o) => ({
					detail: [
						['Nivel', o.level === 'critical' ? 'Crítico' : 'Aviso'],
						['Señales', o.signals.join(', ')]
					]
				})
			)
		),
		...op(
			maritimePoints(navwarn),
			'maritime',
			by(
				navwarn,
				(w) => `n-${w.id}`,
				(w) => ({
					t: w.issued,
					detail: [['Aviso', w.id], ['Zona', w.region], ...(w.place ? [['Lugar', w.place] as [string, string]] : [])]
				})
			)
		),
		...op(
			airspacePoints(czib),
			'airspace',
			by(
				czib,
				(c) => `a-${c.id}`,
				(c) => ({
					t: c.revised ?? c.issued,
					detail: [
						['Boletín', c.id],
						['Emitido', c.issued],
						...(c.revised ? [['Revisado', c.revised] as [string, string]] : []),
						['Válido hasta', c.validUntil ?? 'Sin fecha de fin']
					]
				})
			)
		),
		...op(travelPoints(d.advisories ?? undefined), 'travel', travelExtra(d.advisories)),
		...op(
			straitPoints(d.portwatch ?? []),
			'straits',
			by(
				d.portwatch,
				(c) => `c-${c.id}`,
				(c) => ({
					t: c.last,
					detail: [
						['Barcos al día (7 d)', nf(c.avg7, 0)],
						...(c.change !== null
							? [['Frente a hace un año', `${c.change > 0 ? '+' : ''}${nf(c.change, 1)} %`] as [string, string]]
							: [])
					]
				})
			)
		),
		...op(sanctions, 'sanctions', sanctionExtra(sanctions, tradeByUrl))
	];
	const seen = new Set<string>();
	return all.filter((p) => !seen.has(p.id) && !!seen.add(p.id));
}

/** Avisos de viaje: hora del último cambio de nivel (o de la última actualización). */
function travelExtra(data: AdvisoriesData | null | undefined): Extra {
	const out: Extra = {};
	for (const p of travelPoints(data ?? undefined)) {
		const a = data!.items.find((x) => x.url === p.url);
		if (!a) continue;
		out[p.id] = {
			t: a.changedAt ?? a.updated,
			detail: [
				['Nivel', `${a.level} de 4`],
				...(a.prevLevel ? [['Antes', `${a.prevLevel} de 4`] as [string, string]] : [])
			]
		};
	}
	return out;
}

/** Sanciones: un punto por país; su hora, la del documento más reciente (el que enlaza). */
function sanctionExtra(points: MapPoint[], byUrl: Map<string, TradeDoc>): Extra {
	return Object.fromEntries(
		points.map((p) => {
			const doc = byUrl.get(p.url);
			return [
				p.id,
				{
					t: doc?.date ?? null,
					detail: doc
						? [
								['Último documento', doc.title],
								['Organismo', doc.agency]
							]
						: []
				}
			];
		})
	);
}

// ── Tiempo ────────────────────────────────────────────────────────────────────────────────────────────

export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;

export type PeriodId = '6h' | '24h' | '72h' | '7d' | '30d' | 'all';
export const PERIODS: readonly { value: PeriodId; label: string; ms: number | null }[] = [
	{ value: '6h', label: '6 h', ms: 6 * HOUR },
	{ value: '24h', label: '24 h', ms: DAY },
	{ value: '72h', label: '72 h', ms: 3 * DAY },
	{ value: '7d', label: '7 d', ms: 7 * DAY },
	{ value: '30d', label: '30 d', ms: 30 * DAY },
	{ value: 'all', label: 'Todo', ms: null }
];
export const periodMs = (p: PeriodId) => PERIODS.find((x) => x.value === p)?.ms ?? null;

/** Lo más que se remonta la línea de tiempo con «Todo»: lo anterior se ve, pero no se rebobina. */
export const MAX_SPAN = 30 * DAY;

export interface Range {
	start: number;
	end: number;
}

/**
 * Rango de la línea de tiempo. Acaba ahora (o en el suceso más reciente, si alguno es del futuro). Con un periodo,
 * empieza ese tiempo antes; con «Todo», en el suceso más antiguo, pero nunca más de MAX_SPAN atrás. Los estados
 * (estrechos, boletines) no estiran el rango: pueden ser de hace años.
 */
export function timeRange(points: Pick<OpPoint, 'at' | 'layer'>[], now: number, period: PeriodId): Range {
	const times = points.filter((p) => p.at !== null && !isState(p.layer)).map((p) => p.at!);
	const end = Math.max(now, ...times);
	const ms = periodMs(period);
	if (ms) return { start: end - ms, end };
	const first = times.length ? Math.min(...times) : end - DAY;
	return { start: Math.max(end - MAX_SPAN, Math.min(first, end - HOUR)), end };
}

export interface Filter {
	layers: ReadonlySet<OpLayer>;
	/** Hasta cuándo se ve (la posición de la línea de tiempo), en ms. */
	cursor: number;
	period: PeriodId;
	/** Los puntos sin hora: ¿se ven? (por defecto, sí: son estados sin fecha). */
	untimed?: boolean;
}

/** ¿Se ve el punto en el momento `cursor`, sin mirar su capa? */
export function inTime(p: Pick<OpPoint, 'at' | 'layer'>, f: Omit<Filter, 'layers'>): boolean {
	if (p.at === null) return f.untimed ?? true;
	if (p.at > f.cursor) return false;
	if (isState(p.layer)) return true;
	const ms = periodMs(f.period);
	return ms === null || p.at >= f.cursor - ms;
}

export const visible = <P extends Pick<OpPoint, 'at' | 'layer'>>(points: P[], f: Filter): P[] =>
	points.filter((p) => f.layers.has(p.layer) && inTime(p, f));

/** Recuento por capa con el filtro de tiempo (encendida o no), para los botones de las capas. */
export function countByLayer(
	points: Pick<OpPoint, 'at' | 'layer'>[],
	f: Omit<Filter, 'layers'>
): Record<OpLayer, number> {
	const out = Object.fromEntries(OP_LAYERS.map((l) => [l.value, 0])) as Record<OpLayer, number>;
	for (const p of points) if (inTime(p, f)) out[p.layer]++;
	return out;
}

/** Sucesos por tramo de la línea de tiempo (sin los estados ni los que no tienen hora), para el histograma. */
export function histogram(points: Pick<OpPoint, 'at' | 'layer'>[], range: Range, bins: number): number[] {
	const out = new Array<number>(Math.max(1, bins)).fill(0);
	const span = range.end - range.start;
	if (span <= 0) return out;
	for (const p of points) {
		if (p.at === null || isState(p.layer) || p.at < range.start || p.at > range.end) continue;
		out[Math.min(out.length - 1, Math.floor(((p.at - range.start) / span) * out.length))]++;
	}
	return out;
}

/** El cursor dentro del rango. */
export const clampCursor = (cursor: number, r: Range) => Math.min(r.end, Math.max(r.start, cursor));

/**
 * Un paso de «Reproducir»: avanza 1/`steps` del rango. Si ya estaba al final, vuelve al principio; al llegar al
 * final, `done` (se para).
 */
export function playStep(cursor: number, r: Range, steps = 120): { cursor: number; done: boolean } {
	// Un cursor de antes del rango (al pasar de «Todo» a «6 h») empieza por el principio, no se queda clavado.
	cursor = Math.max(r.start, cursor);
	if (cursor >= r.end) return { cursor: r.start, done: false };
	const next = Math.min(r.end, cursor + (r.end - r.start) / steps);
	return { cursor: next, done: next >= r.end };
}

/** «hace 3 h 20 min», «hace 2 d 4 h», «ahora»: cuánto va de `t` a `now`. */
export function ago(t: number, now: number): string {
	const m = Math.round((now - t) / 60_000);
	if (m <= 0) return m < 0 ? 'en el futuro' : 'ahora';
	if (m < 60) return `hace ${m} min`;
	const h = Math.floor(m / 60);
	if (h < 48) return `hace ${h} h${m % 60 ? ` ${m % 60} min` : ''}`;
	const d = Math.floor(h / 24);
	return `hace ${d} d${h % 24 ? ` ${h % 24} h` : ''}`;
}

/** Lo más nuevo primero; los que no tienen hora, al final. */
export const newestFirst = <P extends Pick<OpPoint, 'at'>>(points: P[]): P[] =>
	[...points].sort((a, b) => (b.at ?? -Infinity) - (a.at ?? -Infinity));

// ── Mapa plano (equirectangular: x = longitud + 180, y = 90 − latitud, como world.ts) ──────────────────

export interface ViewBox {
	x: number;
	y: number;
	w: number;
	h: number;
}

export const WORLD: ViewBox = { x: 0, y: 8, w: 360, h: 150 };
export const MIN_W = 12;

export const toXY = (lat: number, lon: number): [number, number] => [lon + 180, 90 - lat];

/** El mundo entero con la proporción de la ventana (ancho/alto en px), centrado. */
export function fitView(aspect: number): ViewBox {
	const a = Number.isFinite(aspect) && aspect > 0 ? aspect : WORLD.w / WORLD.h;
	if (a >= WORLD.w / WORLD.h) {
		const w = WORLD.h * a;
		return { x: WORLD.x + (WORLD.w - w) / 2, y: WORLD.y, w, h: WORLD.h };
	}
	const h = WORLD.w / a;
	return { x: WORLD.x, y: WORLD.y + (WORLD.h - h) / 2, w: WORLD.w, h };
}

/** El mismo encuadre (centro y ancho) con otra proporción: al girar el móvil o cambiar la ventana con zoom puesto. */
export function reaspect(v: ViewBox, aspect: number): ViewBox {
	if (!(Number.isFinite(aspect) && aspect > 0)) return v;
	const h = v.w / aspect;
	return { x: v.x, y: v.y + (v.h - h) / 2, w: v.w, h };
}

/** Que no se salga del mundo más de media pantalla. */
export function clampView(v: ViewBox): ViewBox {
	const cx = Math.min(360, Math.max(0, v.x + v.w / 2));
	const cy = Math.min(180, Math.max(0, v.y + v.h / 2));
	return { ...v, x: cx - v.w / 2, y: cy - v.h / 2 };
}

/**
 * Acercar (factor < 1) o alejar (> 1) dejando quieto el punto (fx, fy), en fracción de la ventana (0–1).
 * Nunca más cerca de MIN_W grados de ancho ni más lejos que `max` (el mundo entero).
 */
export function zoomAt(v: ViewBox, factor: number, fx: number, fy: number, max: ViewBox): ViewBox {
	const w = Math.min(max.w, Math.max(MIN_W, v.w * factor));
	const k = w / v.w;
	const h = v.h * k;
	if (w >= max.w) return max;
	return clampView({ x: v.x + (v.w - w) * fx, y: v.y + (v.h - h) * fy, w, h });
}

/** Mover el mapa `dx`, `dy` px en una ventana de `pw` × `ph` px. */
export const panBy = (v: ViewBox, dx: number, dy: number, pw: number, ph: number): ViewBox =>
	clampView({ ...v, x: v.x - (dx * v.w) / Math.max(1, pw), y: v.y - (dy * v.h) / Math.max(1, ph) });

/** Centrar un punto sin cambiar el zoom. */
export function centerOn(v: ViewBox, lat: number, lon: number): ViewBox {
	const [x, y] = toXY(lat, lon);
	return clampView({ ...v, x: x - v.w / 2, y: y - v.h / 2 });
}

// ── Parámetros de la ventana (Win.path): «?capas=quakes,storms&periodo=24h» ──────────────────────────

export function parseParams(path: string | undefined): { layers?: OpLayer[]; period?: PeriodId } {
	const q = new URLSearchParams((path ?? '').split('?')[1] ?? '');
	const ids = new Set<string>(OP_LAYERS.map((l) => l.value));
	const layers = (q.get('capas') ?? '')
		.split(',')
		.map((s) => s.trim())
		.filter((s): s is OpLayer => ids.has(s));
	const p = q.get('periodo');
	const period = PERIODS.some((x) => x.value === p) ? (p as PeriodId) : undefined;
	return { ...(layers.length ? { layers } : {}), ...(period ? { period } : {}) };
}
