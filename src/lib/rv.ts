// RV: un valor frente a su sector. Las cifras salen de Finnhub /stock/metric («basic financials», plan gratuito),
// que ya consulta scripts/sources/perf.ts para unos 60 grandes valores de EE. UU.; los competidores, de
// /stock/peers (scripts/sources/peers.ts). Solo se compara con los competidores que también están en esa lista.
// Este archivo lo usan el script (toMetrics) y las vistas: no puede usar nada de Vite.

/** Cifras de un valor. null si Finnhub no la da. */
export interface Metrics {
	pe: number | null;
	pb: number | null;
	ps: number | null;
	divYield: number | null;
	roe: number | null;
	margin: number | null;
	revGrowth: number | null;
	epsGrowth: number | null;
	beta: number | null;
	/** Capitalización, en millones de dólares. */
	cap: number | null;
	high52: number | null;
	low52: number | null;
	high52Date: string | null;
	low52Date: string | null;
}

type NumKey = Exclude<keyof Metrics, 'high52Date' | 'low52Date'>;

/** Claves de Finnhub de cada cifra, por orden de preferencia. */
const KEYS: Record<NumKey, string[]> = {
	pe: ['peTTM', 'peBasicExclExtraTTM', 'peExclExtraTTM'],
	pb: ['pbQuarterly', 'pbAnnual'],
	ps: ['psTTM', 'psAnnual'],
	divYield: ['currentDividendYieldTTM', 'dividendYieldIndicatedAnnual'],
	roe: ['roeTTM', 'roeRfy'],
	margin: ['netProfitMarginTTM', 'netProfitMarginAnnual'],
	revGrowth: ['revenueGrowthTTMYoy', 'revenueGrowthQuarterlyYoy'],
	epsGrowth: ['epsGrowthTTMYoy', 'epsGrowthQuarterlyYoy'],
	beta: ['beta'],
	cap: ['marketCapitalization'],
	high52: ['52WeekHigh'],
	low52: ['52WeekLow']
};

const round = (n: number) => Math.round(n * 100) / 100;

/** Las cifras de la respuesta de /stock/metric; null si no trae ninguna. */
export function toMetrics(body: { metric?: Record<string, unknown> } | null): Metrics | null {
	const m = body?.metric ?? {};
	const pick = (keys: string[]) => {
		for (const k of keys) {
			const v = m[k];
			if (typeof v === 'number' && Number.isFinite(v)) return round(v);
		}
		return null;
	};
	const date = (k: string) => (typeof m[k] === 'string' && /^\d{4}-\d{2}-\d{2}/.test(m[k] as string) ? (m[k] as string).slice(0, 10) : null);
	const out = Object.fromEntries(Object.entries(KEYS).map(([k, keys]) => [k, pick(keys)])) as Record<NumKey, number | null>;
	if (Object.values(out).every((v) => v === null)) return null;
	return { ...out, high52Date: date('52WeekHighDate'), low52Date: date('52WeekLowDate') };
}

/** Las cifras que se comparan, con cuál es mejor (alto o bajo) para el valor. */
export const RV_ROWS: { key: NumKey; label: string; unit: string; better: 'high' | 'low' | null }[] = [
	{ key: 'pe', label: 'PER', unit: '×', better: 'low' },
	{ key: 'ps', label: 'Precio / ventas', unit: '×', better: 'low' },
	{ key: 'pb', label: 'Precio / valor contable', unit: '×', better: 'low' },
	{ key: 'margin', label: 'Margen neto', unit: ' %', better: 'high' },
	{ key: 'roe', label: 'Rentabilidad (ROE)', unit: ' %', better: 'high' },
	{ key: 'revGrowth', label: 'Crecimiento de ventas', unit: ' %', better: 'high' },
	{ key: 'epsGrowth', label: 'Crecimiento del BPA', unit: ' %', better: 'high' },
	{ key: 'divYield', label: 'Dividendo', unit: ' %', better: 'high' },
	{ key: 'beta', label: 'Beta', unit: '', better: null }
];

/** Mediana; null sin valores. */
export function median(values: number[]): number | null {
	if (!values.length) return null;
	const s = [...values].sort((a, b) => a - b);
	const mid = Math.floor(s.length / 2);
	return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export interface RvRow {
	key: NumKey;
	label: string;
	unit: string;
	value: number | null;
	median: number | null;
	/** Puesto entre el valor y sus competidores con dato (1 = el mejor); null si no hay «mejor». */
	rank: number | null;
	of: number;
	/** ¿Mejor que la mediana? null si no se puede decir. */
	better: boolean | null;
}

/**
 * Compara un valor con sus competidores. Un PER negativo (pérdidas) no cuenta para la mediana ni el puesto
 * del PER. Solo entran los competidores con cifras.
 */
export function compareWithPeers(code: string, peers: string[], metrics: Record<string, Metrics>): { rows: RvRow[]; peers: string[] } {
	const own = metrics[code];
	const others = peers.filter((p) => p !== code && metrics[p]);
	const rows = RV_ROWS.map((r) => {
		const ok = (v: number | null): v is number => v !== null && !(r.key === 'pe' && v <= 0);
		const value = own?.[r.key] ?? null;
		const peerValues = others.map((p) => metrics[p][r.key]).filter(ok);
		const med = median(peerValues);
		const all = ok(value) ? [...peerValues, value] : peerValues;
		const rank = r.better && ok(value) ? 1 + all.filter((v) => (r.better === 'high' ? v > value : v < value)).length : null;
		const better = r.better && ok(value) && med !== null && value !== med ? (r.better === 'high' ? value > med : value < med) : null;
		return { key: r.key, label: r.label, unit: r.unit, value, median: med, rank, of: all.length, better };
	});
	return { rows, peers: others };
}
