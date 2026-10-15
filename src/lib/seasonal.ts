// Estacionalidad mensual de una serie: cuánto suele cambiar en cada mes del año, con el historial que guarda la
// terminal. Las series en % o pb (tipos, rentabilidades, paro) se miden en diferencia; el resto (precios,
// índices), en variación porcentual. Lógica pura, sin Svelte, para probarla con Vitest.
import type { Point } from './types.ts';

export const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export interface MonthStat {
	/** Cambio medio de ese mes; null si no hay ningún año con dato. */
	mean: number | null;
	median: number | null;
	/** Años en que subió, de `n`. */
	up: number;
	n: number;
}

export interface Seasonality {
	/** «diff»: diferencia en las unidades de la serie (pp o pb); «pct»: variación en %. */
	mode: 'diff' | 'pct';
	/** Años con algún mes, del más reciente al más antiguo, y el cambio de cada mes (null si falta). */
	years: { year: number; months: (number | null)[] }[];
	months: MonthStat[];
	/** Primer y último mes con dato («2019-01»), y cuántos meses de cambios hay. */
	from: string;
	to: string;
	count: number;
}

/** Si una unidad se mide en diferencia (tipos y porcentajes) en lugar de en variación porcentual. */
export const isRate = (unit: string) => /^(%|pb|pp|puntos?)$/i.test(unit.trim()) || unit.includes('%');

/** Último valor de cada mes («2026-10» → v). Vale para series diarias y mensuales; las demás no tienen mes. */
export function monthEnds(points: Point[]): Map<string, number> {
	const out = new Map<string, number>();
	for (const p of [...points].sort((a, b) => a.t.localeCompare(b.t))) {
		const m = /^(\d{4}-\d{2})(-\d{2})?$/.exec(p.t);
		if (m) out.set(m[1], p.v);
	}
	return out;
}

const median = (xs: number[]) => {
	if (!xs.length) return null;
	const s = [...xs].sort((a, b) => a - b);
	const h = Math.floor(s.length / 2);
	return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
};

/** El mes anterior a «2026-01»: «2025-12». */
function prevMonth(key: string): string {
	const [y, m] = key.split('-').map(Number);
	return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

/** Estacionalidad de una serie, o null si no tiene al menos dos meses seguidos. */
export function seasonality(points: Point[], unit: string): Seasonality | null {
	const mode = isRate(unit) ? 'diff' : 'pct';
	const ends = monthEnds(points);
	const byYear = new Map<number, (number | null)[]>();
	let count = 0;
	for (const [key, v] of ends) {
		const before = ends.get(prevMonth(key));
		if (before === undefined) continue;
		if (mode === 'pct' && !before) continue;
		const change = mode === 'diff' ? v - before : ((v - before) / Math.abs(before)) * 100;
		const [y, m] = key.split('-').map(Number);
		if (!byYear.has(y)) byYear.set(y, Array(12).fill(null));
		byYear.get(y)![m - 1] = change;
		count++;
	}
	if (!count) return null;
	const years = [...byYear.entries()].sort((a, b) => b[0] - a[0]).map(([year, months]) => ({ year, months }));
	const months = MONTHS.map((_, i) => {
		const xs = years.flatMap((y) => (y.months[i] === null ? [] : [y.months[i] as number]));
		return { mean: xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null, median: median(xs), up: xs.filter((x) => x > 0).length, n: xs.length };
	});
	const keys = [...ends.keys()];
	return { mode, years, months, from: keys[0], to: keys[keys.length - 1], count };
}
