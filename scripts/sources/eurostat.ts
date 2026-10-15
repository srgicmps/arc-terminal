// Eurostat: API de difusión en JSON-stat (sin clave).
// https://wikis.ec.europa.eu/display/EUROSTATHELP/API+Statistics · Reutilización libre citando la fuente.
import type { Series, SeriesData } from '../../src/lib/types.ts';
import { getJson, settle, type Source } from '../lib.ts';

const API = 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data';

interface Wanted {
	dataset: string;
	id: string;
	label: string;
	unit: string;
	params: Record<string, string>;
}

const WANTED: Wanted[] = [
	{
		dataset: 'une_rt_m',
		id: 'unemployment',
		label: 'Paro',
		unit: '%',
		params: { age: 'TOTAL', sex: 'T', s_adj: 'SA', unit: 'PC_ACT', lastTimePeriod: '25' }
	},
	{
		dataset: 'une_rt_m',
		id: 'youth-unemployment',
		label: 'Paro juvenil (<25)',
		unit: '%',
		params: { age: 'Y_LT25', sex: 'T', s_adj: 'SA', unit: 'PC_ACT', lastTimePeriod: '25' }
	},
	{
		// Desde 2026 el IPCA va con la clasificación COICOP 2018 (ECOICOP v2): prc_hicp_manr se quedó en 2025-12.
		// En prc_hicp_minr, el índice general es TOTAL y la variación anual, RCH_A.
		dataset: 'prc_hicp_minr',
		id: 'inflation',
		label: 'Inflación (IPCA)',
		unit: '%',
		params: { coicop18: 'TOTAL', unit: 'RCH_A', lastTimePeriod: '25' }
	},
	{
		dataset: 'namq_10_gdp',
		id: 'gdp',
		label: 'PIB, trimestral',
		unit: '%',
		params: { unit: 'CLV_PCH_PRE', s_adj: 'SCA', na_item: 'B1GQ', lastTimePeriod: '12' }
	},
	{
		dataset: 'namq_10_gdp',
		id: 'gdp-yoy',
		label: 'PIB, interanual',
		unit: '%',
		// Frente al mismo trimestre del año anterior.
		params: { unit: 'CLV_PCH_SM', s_adj: 'SCA', na_item: 'B1GQ', lastTimePeriod: '12' }
	},
	{
		dataset: 'gov_10q_ggdebt',
		id: 'debt',
		label: 'Deuda pública',
		unit: '% PIB',
		params: { unit: 'PC_GDP', sector: 'S13', na_item: 'GD', lastTimePeriod: '8' }
	},
	{
		// Encuestas de la Comisión Europea: índice de sentimiento económico (100 = media a largo plazo).
		dataset: 'ei_bssi_m_r2',
		id: 'esi',
		label: 'Sentimiento económico (ESI)',
		unit: 'índice',
		params: { indic: 'BS-ESI-I', s_adj: 'SA', lastTimePeriod: '25' }
	},
	{
		// Saldo de respuestas: % de optimistas menos % de pesimistas.
		dataset: 'ei_bssi_m_r2',
		id: 'consumer-conf',
		label: 'Confianza del consumidor',
		unit: 'saldo',
		params: { indic: 'BS-CSMCI-BAL', s_adj: 'SA', lastTimePeriod: '25' }
	}
];

// Países y zonas que se guardan. La zona euro cambia de código al entrar países (EA20 → EA21):
// se queda la primera que exista y se guarda como «EA».
const GEOS = ['ES', 'DE', 'FR', 'IT', 'PT', 'EU27_2020'];
const EURO_AREA = ['EA21', 'EA20', 'EA'];

interface JsonStat {
	id: string[];
	size: number[];
	dimension: Record<string, { category: { index: Record<string, number> | string[] } }>;
	value: Record<string, number> | (number | null)[];
}

/** Posición de cada código dentro de su dimensión. */
function indexOf(stat: JsonStat, dim: string): Record<string, number> {
	const index = stat.dimension[dim]?.category.index ?? {};
	return Array.isArray(index) ? Object.fromEntries(index.map((code, i) => [code, i])) : index;
}

async function fetchDataset(w: Wanted): Promise<Series[]> {
	const params = new URLSearchParams({ format: 'JSON', lang: 'EN', ...w.params });
	const stat = await getJson<JsonStat>(`${API}/${w.dataset}?${params}`);
	const geoIndex = indexOf(stat, 'geo');
	const timeIndex = indexOf(stat, 'time');
	const times = Object.entries(timeIndex).sort((a, b) => a[1] - b[1]);

	// Los valores van en una lista plana: la posición se calcula como en un array multidimensional.
	const strides = stat.size.map((_, i) => stat.size.slice(i + 1).reduce((a, b) => a * b, 1));
	const value = (geoPos: number, timePos: number): number | null => {
		let flat = 0;
		stat.id.forEach((dim, i) => {
			const pos = dim === 'geo' ? geoPos : dim === 'time' ? timePos : 0;
			flat += pos * strides[i];
		});
		const v = Array.isArray(stat.value) ? stat.value[flat] : stat.value[String(flat)];
		return typeof v === 'number' ? v : null;
	};

	const euro = EURO_AREA.find((code) => code in geoIndex);
	const wanted = [...GEOS, ...(euro ? [euro] : [])].filter((code) => code in geoIndex);
	return wanted.flatMap((code) => {
		const points = times
			.map(([t, pos]) => ({ t, v: value(geoIndex[code], pos) }))
			.filter((p): p is { t: string; v: number } => p.v !== null);
		if (!points.length) return [];
		const geo = code === euro ? 'EA' : code === 'EU27_2020' ? 'EU' : code;
		return [
			{
				id: `${w.id}-${geo.toLowerCase()}`,
				label: w.label,
				unit: w.unit,
				geo,
				points,
				source: 'Eurostat',
				url: `https://ec.europa.eu/eurostat/databrowser/view/${w.dataset}/default/table`
			}
		];
	});
}

export const eurostat: Source<SeriesData> = {
	name: 'eurostat',
	label: 'Paro, inflación, PIB, deuda y confianza · Eurostat',
	maxAgeMinutes: 355,
	// Si a la copia le falta alguna serie (p. ej., una recién añadida), se descarga de nuevo sin esperar.
	isStale: (previous) =>
		WANTED.some((w) => !previous.series?.some((s) => new RegExp(`^${w.id}-[a-z0-9_]+$`).test(s.id))),
	async fetch() {
		const groups = await settle('eurostat', WANTED, (w) => `${w.dataset} (${w.id})`, fetchDataset);
		const series = groups.flat();
		if (!series.length) throw new Error('ninguna serie de Eurostat');
		return { series };
	}
};
