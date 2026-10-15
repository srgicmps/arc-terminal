// MI IPC (F10): tu inflación con los pesos de tu cesta, sobre el IPCA de España por grupos (static/data/cesta.json).
import type { Series } from './types.ts';

export interface CpiGroup {
	/** CP01…CP13 (COICOP 2018). */
	code: string;
	label: string;
	/** Peso en la cesta media de España, en tanto por mil. */
	weight: number;
	/** Variación anual del último mes, en %. */
	rate: number | null;
}

export interface CestaData {
	/** Índice general mensual (2015 = 100), desde 2002. */
	index: Series;
	/** Inflación general del último mes, en %. */
	total: number | null;
	month: string;
	weightsYear: string;
	groups: CpiGroup[];
}

/** Clave de los pesos de tu cesta, en % de tu gasto: { CP01: 20, … }. */
export const BASKET_KEY = 'arc-basket';

/** Lee tus pesos guardados: solo grupos conocidos y números ≥ 0. */
export function parseBasket(text: string | null, codes: string[]): Record<string, number> {
	try {
		const data: unknown = JSON.parse(text ?? '{}');
		if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
		const out: Record<string, number> = {};
		for (const [k, v] of Object.entries(data)) if (codes.includes(k) && typeof v === 'number' && Number.isFinite(v) && v >= 0) out[k] = v;
		return out;
	} catch {
		return {};
	}
}

/**
 * Tu inflación: media de las tasas de cada grupo con tus pesos en % (los que no pongas, con el de la cesta media,
 * que viene en tanto por mil). Si no suman 100, se reparten en proporción.
 * Los grupos sin tasa no cuentan. null si no queda ningún peso.
 */
export function myInflation(groups: CpiGroup[], mine: Record<string, number>): number | null {
	let sum = 0;
	let total = 0;
	for (const g of groups) {
		const w = mine[g.code] ?? g.weight / 10;
		if (g.rate === null || !(w > 0)) continue;
		sum += w * g.rate;
		total += w;
	}
	return total > 0 ? sum / total : null;
}
