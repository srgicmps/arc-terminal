// AHORRO (F9 y F11): cuánto crece el dinero con interés compuesto y cuánto vale hoy el de otro año. Lógica pura.
import type { Point } from './types.ts';

export interface Growth {
	/** Capital al final de cada año (año 0 = hoy). */
	years: { year: number; total: number; contributed: number }[];
	total: number;
	contributed: number;
	interest: number;
}

/**
 * Interés compuesto con aportación mensual: `initial` hoy, `monthly` al final de cada mes, a un tipo anual
 * `ratePct` (en %) que se capitaliza cada mes, durante `years` años. Sin impuestos ni comisiones.
 */
export function compound(initial: number, monthly: number, ratePct: number, years: number): Growth | null {
	const n = Math.round(years * 12);
	if (!(initial >= 0) || !(monthly >= 0) || !Number.isFinite(ratePct) || !(n > 0) || n > 100 * 12) return null;
	const i = ratePct / 100 / 12;
	let total = initial;
	let contributed = initial;
	const rows = [{ year: 0, total, contributed }];
	for (let m = 1; m <= n; m++) {
		total = total * (1 + i) + monthly;
		contributed += monthly;
		if (m % 12 === 0 || m === n) rows.push({ year: Math.ceil(m / 12), total, contributed });
	}
	return { years: rows, total, contributed, interest: total - contributed };
}

/** Punto de una serie mensual en ese mes («2005-01»), o el más cercano después (hasta 12 meses). */
function at(points: Point[], ym: string): Point | null {
	return points.find((p) => p.t >= ym && p.t <= `${Number(ym.slice(0, 4)) + 1}${ym.slice(4)}`) ?? null;
}

/**
 * Lo que valen hoy `amount` de `ym` con un índice de precios mensual: amount · índice de hoy / índice de entonces.
 * Devuelve también la inflación acumulada (en %) y los meses que usa de verdad.
 */
export function realValue(amount: number, index: Point[], ym: string): { value: number; inflation: number; from: Point; to: Point } | null {
	const sorted = [...index].sort((a, b) => a.t.localeCompare(b.t));
	const from = at(sorted, ym);
	const to = sorted.at(-1);
	if (!from || !to || !(from.v > 0) || !(amount >= 0)) return null;
	return { value: (amount * to.v) / from.v, inflation: (to.v / from.v - 1) * 100, from, to };
}
