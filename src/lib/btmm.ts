// BTMM: mercado monetario de EE. UU. y la zona euro en una pantalla. Junta series que ya se descargan (Fed de
// Nueva York, FRED, BCE) y los plazos cortos de las curvas del Tesoro y del BCE.
import type { Point, Series, YieldCurveData } from './types.ts';

export interface MoneyRow {
	id: string;
	label: string;
	/** Último valor, en %. */
	v: number;
	/** Fecha del último valor: «2026-10-14» o «2026-09» (mensual). */
	t: string;
	/** Cambio frente al dato anterior, en pb. */
	d: number | null;
	/** Cambio frente a hace un mes (o el dato anterior más cercano), en pb. */
	m: number | null;
	/** Volumen negociado, en miles de millones de dólares (solo los tipos de la Fed de Nueva York). */
	vol?: number | null;
}

const pb = (a: number, b: Point | undefined) => (b ? Math.round((a - b.v) * 100) : null);

/** Fecha de hace un mes con el mismo formato que `t` (diario o mensual). */
function monthBefore(t: string): string {
	if (/^\d{4}-\d{2}$/.test(t)) {
		const [y, m] = t.split('-').map(Number);
		return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
	}
	return new Date(Date.parse(`${t}T12:00:00Z`) - 30 * 86_400_000).toISOString().slice(0, 10);
}

/** Fila de una serie: último valor, cambio en el último dato y en un mes. Null si no hay serie. */
export function moneyRow(s: Series | undefined, label = s?.label, vol?: Series): MoneyRow | null {
	const pts = s?.points ?? [];
	const now = pts[pts.length - 1];
	if (!s || !now || !label) return null;
	const target = monthBefore(now.t);
	const month = pts.findLast((p) => p.t <= target);
	const row: MoneyRow = { id: s.id, label, v: now.v, t: now.t, d: pb(now.v, pts[pts.length - 2]), m: pb(now.v, month) };
	if (vol) row.vol = vol.points.find((p) => p.t === now.t)?.v ?? null;
	return row;
}

/** Un plazo de una curva (uscurve, eacurve) como serie diaria. */
export function tenorSeries(curve: YieldCurveData | null | undefined, tenor: string, id: string, label: string): Series | undefined {
	const i = curve?.tenors.indexOf(tenor) ?? -1;
	if (!curve || i < 0) return undefined;
	const points = curve.days.flatMap((d) => (d.values[i] == null ? [] : [{ t: d.date, v: d.values[i] as number }]));
	return { id, label, unit: '%', points, source: '' };
}

/** Diferencial a − b en pb con los últimos valores de dos filas (SOFR − IORB, SOFR − €STR). */
export function gap(a: MoneyRow | null, b: MoneyRow | null): number | null {
	return a && b ? Math.round((a.v - b.v) * 100) : null;
}

/**
 * Diferencial a − b en pb, los dos del MISMO día (para las frases del modo Sencillo, que sacan conclusiones).
 * `a`: un tipo diario (SOFR, €STR), que sale al día siguiente. `b`: lo que paga el banco central. Con `step`, `b` solo
 * trae los días en que cambia (facilidad de depósito del BCE) y vale el que estaba en vigor el último día de `a`. Sin él,
 * `b` es diario (IORB, de FRED) y se comparan en el último día que tienen los dos. Así, el día en que cambia el tipo no
 * se mezcla el dato de antes con el tipo nuevo. Null si falta alguno.
 */
export function gapOn(a: Series | undefined, b: Series | undefined, step = false): number | null {
	const lastA = a?.points.at(-1)?.t;
	const lastB = b?.points.at(-1)?.t;
	if (!a || !b || !lastA || !lastB) return null;
	const day = a.points.findLast((p) => p.t <= (step || lastA <= lastB ? lastA : lastB));
	const paid = day && b.points.findLast((p) => p.t <= day.t);
	return day && paid ? Math.round((day.v - paid.v) * 100) : null;
}
