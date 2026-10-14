// Diferenciales de crédito (WS): si el de alto rendimiento está por encima de su media del último año, señal de
// que el mercado pide más prima por el riesgo de impago. Lógica pura, con tests.
import type { Point } from './types.ts';
import { lastYear } from './risk.ts';

/** Último valor frente a la media de su último año. null si no hay datos. */
export function versusYear(points: readonly Point[]): { last: number; mean: number; above: boolean } | null {
	const year = lastYear(points);
	if (!year.length) return null;
	const mean = year.reduce((a, p) => a + p.v, 0) / year.length;
	const last = year.at(-1)!.v;
	return { last, mean, above: last > mean };
}
