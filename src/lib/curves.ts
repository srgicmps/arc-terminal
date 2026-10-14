// Ayudantes para comparar curvas de tipos (WS): el día de hoy, el de hace una semana o un año, y un plazo.
import type { YieldCurveData } from './types.ts';

type Day = YieldCurveData['days'][number];

/** Fecha ISO (AAAA-MM-DD) `days` días antes de `date`. */
export function daysBefore(date: string, days: number): string {
	const d = new Date(`${date}T12:00:00Z`);
	d.setUTCDate(d.getUTCDate() - days);
	return d.toISOString().slice(0, 10);
}

/**
 * El último día publicado en o antes de `date` (los fines de semana y festivos no hay curva). Si la
 * historia no llega tan atrás, null: así no se compara con una fecha que no es la que se pide.
 */
export function dayAt(curve: YieldCurveData, date: string): Day | null {
	let found: Day | null = null;
	for (const d of curve.days) {
		if (d.date > date) break;
		found = d;
	}
	// Más de 10 días de diferencia: la historia tiene un hueco justo ahí, mejor no comparar.
	return found && found.date >= daysBefore(date, 10) ? found : null;
}

/** Valor de un plazo («10A») en un día, o null si no está. */
export function tenor(curve: YieldCurveData, day: Day | null, label: string): number | null {
	const i = curve.tenors.indexOf(label);
	return i < 0 || !day ? null : (day.values[i] ?? null);
}

/** Fila de la tabla comparada: 2A, 10A, pendiente (10A − 2A, en pb) y variación del 10A en una semana (pb). */
export interface CurveRow {
	date: string;
	y2: number | null;
	y10: number | null;
	slope: number | null;
	week10: number | null;
}

const bp = (a: number | null, b: number | null) => (a === null || b === null ? null : Math.round((a - b) * 100));

export function curveRow(curve: YieldCurveData): CurveRow | null {
	const today = curve.days.at(-1);
	if (!today) return null;
	const week = dayAt(curve, daysBefore(today.date, 7));
	const y2 = tenor(curve, today, '2A');
	const y10 = tenor(curve, today, '10A');
	return { date: today.date, y2, y10, slope: bp(y10, y2), week10: bp(y10, tenor(curve, week, '10A')) };
}
