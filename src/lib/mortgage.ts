// Cuota de una hipoteca a tipo variable (sistema francés: todas las cuotas iguales). Se calcula en el navegador.
import { last } from './series.ts';
import type { Point, Series } from './types.ts';

/**
 * Cuota mensual de un préstamo de `capital` euros a `years` años con un tipo anual `ratePct` (en %).
 * Fórmula: cuota = C · i / (1 − (1 + i)^−n), con i el tipo mensual (ratePct / 100 / 12) y n el número de cuotas.
 * Si el tipo es 0 (o negativo: desde la Ley 5/2019 el interés de una hipoteca no puede bajar de 0), es C / n.
 */
export function monthlyPayment(capital: number, years: number, ratePct: number): number | null {
	const n = Math.round(years * 12);
	if (!(capital > 0) || !(n > 0) || !Number.isFinite(ratePct)) return null;
	const i = Math.max(ratePct, 0) / 100 / 12;
	if (i === 0) return capital / n;
	return (capital * i) / (1 - (1 + i) ** -n);
}

/** Último dato de una serie mensual («2026-09») y el del mismo mes del año anterior, si lo hay. */
export function lastAndYearAgo(s: Series | undefined): { now: Point; before: Point | null } | null {
	const now = last(s);
	if (!now) return null;
	const m = now.t.match(/^(\d{4})-(\d{2})$/);
	const t = m ? `${Number(m[1]) - 1}-${m[2]}` : '';
	return { now, before: s?.points.find((p) => p.t === t) ?? null };
}
