// EIA (https://www.eia.gov/petroleum/supply/weekly/): inventarios semanales de petróleo de EE. UU. Salen los
// miércoles (10:30 de Nueva York), con datos hasta el viernes anterior.
//
// Necesita la clave EIA_API_KEY (gratuita); sin ella, la fuente se salta. La API v2 solo la acepta en la
// URL (api_key=…), así que ningún error de aquí lleva la URL: request() la escribe en el mensaje, y ese
// mensaje acaba en el estado de las fuentes, que es público. Datos de dominio público.
import type { EiaData, EiaStock } from '../../src/lib/eia.ts';
import { getJson, list, num, plain, type Source } from '../lib.ts';

export type { EiaData };

type Raw = Record<string, any>;

const ENV = 'EIA_API_KEY';
const API = 'https://api.eia.gov/v2/petroleum/stoc/wstk/data/';
/** Semanas que se guardan; para la media de 5 años se piden algo más de 6 años. */
const KEEP = 53;
const YEARS = 5;

export const EIA_SERIES = [
	{ id: 'WCESTUS1', label: 'Crudo, sin la reserva' },
	{ id: 'WGTSTUS1', label: 'Gasolina' },
	{ id: 'WDISTUS1', label: 'Destilados' },
	{ id: 'W_EPC0_SAX_YCUOK_MBBL', label: 'Crudo en Cushing' },
	{ id: 'WCSSTUS1', label: 'Reserva estratégica' }
];

/**
 * La URL de una serie, sin la clave (la clave se añade al pedirla). Una petición por serie: la API es lenta y
 * una sola con las cinco se pasaba del tiempo máximo.
 */
export function eiaQuery(start: string, series: string): string {
	const q = new URLSearchParams({ frequency: 'weekly', 'data[0]': 'value', start, 'sort[0][column]': 'period', 'sort[0][direction]': 'asc', length: '5000' });
	q.append('facets[series][]', series);
	return `${API}?${q}`;
}

const DAY = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Valor de la semana más cercana a `ms` (±3 días); así se salta el desfase de las semanas entre años. */
function near(points: Map<string, number>, ms: number): number | null {
	for (const d of [0, -1, 1, -2, 2, -3, 3]) {
		const v = points.get(iso(ms + d * DAY));
		if (v !== undefined) return v;
	}
	return null;
}

/** Agrupa por serie, pasa de miles a millones de barriles y calcula la media de 5 años de la última semana. */
export function parseEia(body: Raw): EiaStock[] {
	const bySeries = new Map<string, Map<string, number>>();
	for (const r of list<Raw>(body?.response?.data)) {
		const v = num(r?.value);
		const t = String(r?.period ?? '');
		if (v === null || !/^\d{4}-\d{2}-\d{2}$/.test(t)) continue;
		const m = bySeries.get(String(r?.series)) ?? new Map<string, number>();
		m.set(t, v / 1000);
		bySeries.set(String(r?.series), m);
	}
	return EIA_SERIES.flatMap((s): EiaStock[] => {
		const m = bySeries.get(s.id);
		if (!m?.size) return [];
		const points = [...m].map(([t, v]) => ({ t, v })).sort((a, b) => a.t.localeCompare(b.t));
		const lastMs = Date.parse(points.at(-1)!.t);
		const past = Array.from({ length: YEARS }, (_, k) => near(m, lastMs - (k + 1) * 364 * DAY));
		const avg5 = past.every((v) => v !== null) ? past.reduce((a, b) => a! + b!, 0)! / YEARS : null;
		return [{ ...s, points: points.slice(-KEEP), avg5 }];
	});
}

export const eia: Source<EiaData> = {
	name: 'eia',
	label: 'Inventarios de petróleo de EE. UU. · EIA',
	maxAgeMinutes: 180,
	requires: ENV,
	// La API tarda: cinco peticiones en paralelo, cada una con sus reintentos de 45 s.
	deadlineMs: 180_000,
	async fetch() {
		const start = iso(Date.now() - (YEARS + 1) * 366 * DAY);
		const key = process.env[ENV] ?? '';
		const hide = (text: string) => (key ? text.replaceAll(key, '***') : text);
		const one = async (series: string): Promise<Raw[]> => {
			let body: Raw;
			try {
				body = await getJson<Raw>(`${eiaQuery(start, series)}&api_key=${encodeURIComponent(key)}`);
			} catch (error) {
				// Fuera la URL (lleva la clave): solo el «HTTP 403» o el fallo de red.
				const msg = (error instanceof Error ? error.message : String(error)).replace(/ ?(en )?https?:\/\/\S+/g, '');
				throw new Error(`La API de la EIA falla: ${hide(msg)}`);
			}
			if (body?.error) throw new Error(`La API de la EIA responde con error: ${plain(hide(String(body.error)), 120)}`);
			return list<Raw>(body?.response?.data);
		};
		// Si falla una serie, siguen las demás; solo falla la fuente si no llega ninguna.
		const results = await Promise.allSettled(EIA_SERIES.map((s) => one(s.id)));
		const rows = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
		const failed = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
		if (!rows.length && failed) throw failed.reason;
		const stocks = parseEia({ response: { data: rows } });
		if (!stocks.length) throw new Error('La EIA no devuelve inventarios');
		return { stocks };
	}
};
