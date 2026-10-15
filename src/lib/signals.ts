// SIG: señales técnicas con datos propios. Máximos y mínimos de 52 semanas recientes, con las fechas que da
// Finnhub en /stock/metric (perf.json, src/lib/rv.ts). Las medias y el RSI van con el widget de TradingView.
import type { Metrics } from './rv.ts';

export interface Extreme {
	code: string;
	/** El máximo o el mínimo de 52 semanas. */
	price: number;
	/** Cuándo lo marcó (AAAA-MM-DD). */
	date: string;
	/** Días desde entonces. */
	days: number;
}

const DAY = 86_400_000;

/** Valores que han marcado un máximo (o un mínimo) de 52 semanas en los últimos `days` días, el más reciente primero. */
export function recentExtremes(metrics: Record<string, Metrics>, now: number, days = 10): { highs: Extreme[]; lows: Extreme[] } {
	const pick = (price: 'high52' | 'low52', date: 'high52Date' | 'low52Date') =>
		Object.entries(metrics)
			.flatMap(([code, m]) => {
				const p = m[price];
				const d = m[date];
				if (p === null || !d) return [];
				const ago = Math.floor((now - Date.parse(`${d}T00:00:00Z`)) / DAY);
				return ago >= 0 && ago <= days ? [{ code, price: p, date: d, days: ago }] : [];
			})
			.sort((a, b) => a.days - b.days || a.code.localeCompare(b.code));
	return { highs: pick('high52', 'high52Date'), lows: pick('low52', 'low52Date') };
}
