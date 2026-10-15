// Línea de tiempo (Arc OS): los carriles. Hay dos clases: de sucesos (puntos en el tiempo, de IMP, USGS,
// GDACS…) y de mercados (una mini-serie de un archivo de static/data). Aquí está qué carriles hay, su orden
// por defecto y cómo se guardan los que elige cada uno (orden, ocultos y rango). Lógica pura.
import { RANGES, type RangeKey } from './scale.ts';

export type EventLane = 'imp' | 'tierra' | 'avisos' | 'datos' | 'agenda' | 'bancos';
export type MarketLane = 'us10' | 'ea10' | 'eurusd' | 'btc' | 'vix' | 'wti' | 'dolar';
export type LaneId = EventLane | MarketLane;

interface Base {
	label: string;
	/** Qué enseña, en una frase (título al pasar por encima). */
	desc: string;
	/** Vista de la terminal a la que lleva el carril. */
	href: string;
}

export interface EventLaneDef extends Base {
	id: EventLane;
	kind: 'events';
	/** Variable CSS del color de sus puntos (bloque «Centro de mando» de tokens.css). */
	color: string;
}

export interface MarketLaneDef extends Base {
	id: MarketLane;
	kind: 'market';
	/** Archivo de static/data y serie (como en el catálogo de G: «uscurve-10A» es el plazo de una curva). */
	ds: string;
	series: string;
	unit: string;
	digits: number;
}

export type LaneDef = EventLaneDef | MarketLaneDef;

export const LANES: LaneDef[] = [
	{ id: 'imp', kind: 'events', label: 'Lo importante', desc: 'Temas de IMP: cuanto más grande, más puntuación', href: '/imp', color: '--cmd-ev-imp' },
	{ id: 'tierra', kind: 'events', label: 'Desastres', desc: 'Terremotos de 4,5 o más (USGS) y alertas naranjas y rojas de GDACS', href: '/geo', color: '--cmd-ev-tierra' },
	{ id: 'avisos', kind: 'events', label: 'Avisos geo', desc: 'Cambios de aviso de viaje, espacio aéreo en conflicto (EASA) y avisos a navegantes', href: '/geo', color: '--cmd-ev-avisos' },
	{ id: 'datos', kind: 'events', label: 'Datos macro', desc: 'Publicaciones de datos: Eurostat, BLS, INE, BEA…', href: '/cal', color: '--cmd-ev-datos' },
	{ id: 'agenda', kind: 'events', label: 'Resultados', desc: 'Resultados empresariales de la agenda (Finnhub)', href: '/cal', color: '--cmd-ev-agenda' },
	{ id: 'bancos', kind: 'events', label: 'Bancos centrales', desc: 'Reuniones del BCE y de la Fed, y discursos de banqueros centrales (BIS)', href: '/btmm', color: '--cmd-ev-bancos' },
	{ id: 'us10', kind: 'market', label: 'Bono EE. UU. 10 a', desc: 'Rentabilidad del bono a 10 años (Tesoro de EE. UU.)', href: '/wb', ds: 'uscurve', series: 'uscurve-10A', unit: '%', digits: 2 },
	{ id: 'ea10', kind: 'market', label: 'Bono euro AAA 10 a', desc: 'Curva AAA de la zona euro a 10 años (BCE)', href: '/wb', ds: 'eacurve', series: 'eacurve-10A', unit: '%', digits: 2 },
	{ id: 'eurusd', kind: 'market', label: 'EUR/USD', desc: 'Cambio de referencia del BCE', href: '/ws', ds: 'ecb', series: 'eurusd', unit: '$', digits: 4 },
	{ id: 'btc', kind: 'market', label: 'Bitcoin', desc: 'Cierre diario en dólares (CoinGecko)', href: '/ws', ds: 'crypto', series: 'btc', unit: '$', digits: 0 },
	{ id: 'vix', kind: 'market', label: 'VIX', desc: 'Volatilidad esperada del S&P 500 (FRED)', href: '/ws', ds: 'fred', series: 'vix', unit: 'pts', digits: 2 },
	{ id: 'wti', kind: 'market', label: 'Petróleo WTI', desc: 'Barril de WTI en dólares (FRED)', href: '/ws', ds: 'fred', series: 'wti', unit: '$', digits: 2 },
	{ id: 'dolar', kind: 'market', label: 'Dólar amplio', desc: 'Índice amplio del dólar de la Fed (FRED)', href: '/ws', ds: 'fred', series: 'dollar-broad', unit: 'pts', digits: 2 }
];

export const laneOf = (id: string): LaneDef | undefined => LANES.find((l) => l.id === id);
const isLane = (id: unknown): id is LaneId => typeof id === 'string' && LANES.some((l) => l.id === id);

/** Por defecto se ven todos los de sucesos y tres de mercados. */
export const DEFAULT_HIDDEN: LaneId[] = ['ea10', 'wti', 'dolar'];

export interface LaneSettings {
	/** Todos los carriles, en el orden en que se pintan. */
	order: LaneId[];
	hidden: LaneId[];
	/** Último rango elegido (24 h, 7 d…). */
	range: RangeKey;
}

export const defaultSettings = (): LaneSettings => ({ order: LANES.map((l) => l.id), hidden: [...DEFAULT_HIDDEN], range: '7d' });

/**
 * Lee lo guardado (JSON) y lo arregla: quita ids que ya no existen y añade al final los carriles nuevos, para
 * que una versión con más carriles no los pierda. Si no se entiende, lo de por defecto.
 */
export function parseSettings(raw: string | null): LaneSettings {
	if (!raw) return defaultSettings();
	try {
		const v = JSON.parse(raw) as Partial<LaneSettings>;
		if (!Array.isArray(v.order)) return defaultSettings();
		const order = [...new Set(v.order.filter(isLane))];
		for (const l of LANES) if (!order.includes(l.id)) order.push(l.id);
		const hidden = Array.isArray(v.hidden) ? [...new Set(v.hidden.filter(isLane))] : [...DEFAULT_HIDDEN];
		const range = RANGES.find((r) => r.value === v.range)?.value ?? '7d';
		return { order, hidden, range };
	} catch {
		return defaultSettings();
	}
}

/** Sube (−1) o baja (+1) un carril un puesto. */
export function moveLane(s: LaneSettings, id: LaneId, dir: -1 | 1): LaneSettings {
	const i = s.order.indexOf(id);
	const j = i + dir;
	if (i < 0 || j < 0 || j >= s.order.length) return s;
	const order = [...s.order];
	[order[i], order[j]] = [order[j], order[i]];
	return { ...s, order };
}

export function toggleLane(s: LaneSettings, id: LaneId): LaneSettings {
	return { ...s, hidden: s.hidden.includes(id) ? s.hidden.filter((x) => x !== id) : [...s.hidden, id] };
}

/** Los carriles que se pintan, en su orden. */
export const visibleLanes = (s: LaneSettings): LaneDef[] => s.order.filter((id) => !s.hidden.includes(id)).flatMap((id) => laneOf(id) ?? []);
