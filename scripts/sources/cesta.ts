// IPCA de España por grupos (Eurostat, COICOP 2018) para AHORRO: tu inflación con los pesos de tu cesta (MI IPC)
// y «cuánto valen hoy X € de otro año». Los datos los elabora el INE y los publica Eurostat (prc_hicp_minr e
// prc_hicp_iw), sin clave, reutilización libre citando la fuente. Desde 2026 el IPCA va en COICOP 2018 (13 grupos).
import type { Series } from '../../src/lib/types.ts';
import type { CestaData, CpiGroup } from '../../src/lib/cesta.ts';
import { getJson, type Source } from '../lib.ts';

const API = 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data';
const URL = 'https://ec.europa.eu/eurostat/databrowser/view/prc_hicp_minr/default/table';

/** Los 13 grupos de COICOP 2018, con su nombre en español. */
export const GROUPS: Record<string, string> = {
	CP01: 'Alimentos y bebidas sin alcohol',
	CP02: 'Bebidas alcohólicas y tabaco',
	CP03: 'Ropa y calzado',
	CP04: 'Vivienda, agua, luz y gas',
	CP05: 'Muebles y hogar',
	CP06: 'Salud',
	CP07: 'Transporte',
	CP08: 'Información y comunicaciones',
	CP09: 'Ocio, deporte y cultura',
	CP10: 'Enseñanza',
	CP11: 'Restaurantes y hoteles',
	CP12: 'Seguros y servicios financieros',
	CP13: 'Cuidado personal y otros'
};

export interface JsonStat {
	id: string[];
	size: number[];
	dimension: Record<string, { category: { index: Record<string, number> | string[] } }>;
	value: Record<string, number> | (number | null)[];
}

const indexOf = (stat: JsonStat, dim: string): Record<string, number> => {
	const index = stat.dimension[dim]?.category.index ?? {};
	return Array.isArray(index) ? Object.fromEntries(index.map((code, i) => [code, i])) : index;
};

/** Valor de una celda: posición de cada dimensión por su código (las que no se dan, la primera). */
export function cell(stat: JsonStat, at: Record<string, string>): number | null {
	let flat = 0;
	let stride = 1;
	for (let i = stat.id.length - 1; i >= 0; i--) {
		const dim = stat.id[i];
		const pos = at[dim] === undefined ? 0 : indexOf(stat, dim)[at[dim]];
		if (pos === undefined) return null;
		flat += pos * stride;
		stride *= stat.size[i];
	}
	const v = Array.isArray(stat.value) ? stat.value[flat] : stat.value[String(flat)];
	return typeof v === 'number' ? v : null;
}

/** Meses de la dimensión de tiempo, en orden. */
export const times = (stat: JsonStat) => Object.entries(indexOf(stat, 'time')).sort((a, b) => a[1] - b[1]).map(([t]) => t);

const query = (dataset: string, params: [string, string][]) =>
	getJson<JsonStat>(`${API}/${dataset}?${new URLSearchParams([['format', 'JSON'], ['lang', 'EN'], ['geo', 'ES'], ...params])}`);

/** Junta el índice, las tasas de cada grupo y los pesos. Pura: la prueba con respuestas de ejemplo. */
export function build(index: JsonStat, rates: JsonStat, weights: JsonStat): CestaData {
	const points = times(index)
		.map((t) => ({ t, v: cell(index, { time: t }) }))
		.filter((p): p is { t: string; v: number } => p.v !== null);
	const month = times(rates).at(-1) ?? '';
	const year = times(weights).at(-1) ?? '';
	const groups: CpiGroup[] = Object.entries(GROUPS).map(([code, label]) => ({
		code,
		label,
		weight: cell(weights, { coicop18: code, time: year }) ?? 0,
		rate: cell(rates, { coicop18: code, time: month })
	}));
	const series: Series = { id: 'hicp-index-es', label: 'IPCA, índice (2015 = 100)', unit: 'índice', geo: 'ES', points, source: 'Eurostat (INE)', url: URL };
	return { index: series, total: cell(rates, { coicop18: 'TOTAL', time: month }), month, weightsYear: year, groups };
}

export const cesta: Source<CestaData> = {
	name: 'cesta',
	label: 'IPCA de España por grupos y pesos de la cesta · Eurostat (INE)',
	maxAgeMinutes: 12 * 60,
	async fetch() {
		const codes = ['TOTAL', ...Object.keys(GROUPS)].map((c): [string, string] => ['coicop18', c]);
		const [index, rates, weights] = await Promise.all([
			query('prc_hicp_minr', [['coicop18', 'TOTAL'], ['unit', 'I15'], ['sinceTimePeriod', '2002-01']]),
			query('prc_hicp_minr', [...codes, ['unit', 'RCH_A'], ['lastTimePeriod', '1']]),
			query('prc_hicp_iw', [...codes.slice(1), ['lastTimePeriod', '1']])
		]);
		const data = build(index, rates, weights);
		if (data.index.points.length < 12 || data.groups.every((g) => g.rate === null)) throw new Error('Eurostat no da el IPCA de España');
		return data;
	}
};
