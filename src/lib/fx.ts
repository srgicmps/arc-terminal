// Conversor de divisas con los tipos de referencia del BCE (series «eurusd», «eurgbp»… de ecb.json).
// Cada serie dice cuántas unidades de una divisa vale 1 euro; para pasar de una divisa a otra se cruzan.
import { last } from './series.ts';
import type { Series } from './types.ts';

export interface FxRate {
	/** Unidades de la divisa por 1 euro. */
	perEur: number;
	/** Día del tipo de referencia: «2026-10-13». */
	date: string;
}

/** Los cambios para la barra (M46): null hasta que se descargan (ver fxlive.svelte.ts). */
export interface FxState {
	rates: Map<string, FxRate> | null;
	status: 'idle' | 'loading' | 'ready' | 'error';
}

/** Tipos por código de divisa («USD», «GBP»…), con el euro a 1. Las series se llaman «eur» + código. */
export function fxRates(series: (Series | undefined)[]): Map<string, FxRate> {
	const rates = new Map<string, FxRate>();
	for (const s of series) {
		const p = last(s);
		if (s && p && p.v > 0 && /^eur[a-z]{3}$/.test(s.id)) rates.set(s.id.slice(3).toUpperCase(), { perEur: p.v, date: p.t });
	}
	const dates = [...rates.values()].map((r) => r.date).sort();
	if (dates.length) rates.set('EUR', { perEur: 1, date: dates[dates.length - 1] });
	return rates;
}

/** Convierte `amount` de `from` a `to`. Null si falta alguna de las dos divisas o la cantidad no es un número. */
export function convert(amount: number, from: string, to: string, rates: Map<string, FxRate>): number | null {
	const a = rates.get(from);
	const b = rates.get(to);
	if (!a || !b || !Number.isFinite(amount)) return null;
	return (amount / a.perEur) * b.perEur;
}
