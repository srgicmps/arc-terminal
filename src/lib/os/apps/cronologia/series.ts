// Línea de tiempo (Arc OS): los carriles de mercados. Saca la serie de cada archivo de static/data (con el
// mismo extract que el gráfico G), la pasa a instantes y la dibuja como una mini-línea en su carril. El
// cursor lee el último valor conocido en su instante. Lógica pura.
import { extract } from '../../../gseries.ts';
import type { Point } from '../../../types.ts';
import type { MarketLaneDef } from './lanes.ts';
import type { Domain, Scale } from './scale.ts';

/** Un punto de una mini-serie: instante en ms y valor. */
export interface TPoint {
	t: number;
	v: number;
}

/** «2026-10-14» → cierre del día (21:00 UTC, tras la sesión de Nueva York); «2026-10» → día 1; ISO, tal cual. */
export function pointTime(p: string): number {
	if (/^\d{4}-\d{2}-\d{2}$/.test(p)) return Date.parse(`${p}T21:00:00Z`);
	if (/^\d{4}-\d{2}$/.test(p)) return Date.parse(`${p}-01T12:00:00Z`);
	const t = Date.parse(p);
	return Number.isFinite(t) ? t : NaN;
}

export const toTPoints = (points: Point[]): TPoint[] =>
	points
		.map((p) => ({ t: pointTime(p.t), v: p.v }))
		.filter((p) => Number.isFinite(p.t) && Number.isFinite(p.v))
		.sort((a, b) => a.t - b.t);

/** La serie de un carril de mercados a partir del `data` de su archivo; vacía si no está. */
export function laneSeries(def: MarketLaneDef, data: unknown): TPoint[] {
	if (!data) return [];
	// Bitcoin no es una serie del catálogo: es el historial de cierres de crypto.json.
	if (def.ds === 'crypto') {
		const h = (data as { btcHistory?: { date: string; usd: number }[] }).btcHistory ?? [];
		return toTPoints(h.map((d) => ({ t: d.date, v: d.usd })));
	}
	return toTPoints(extract(data, { id: def.series, ds: def.ds, label: def.label, unit: def.unit, from: '', n: 0 }));
}

/** Índice del último punto con t ≤ `t` (búsqueda binaria), o −1 si todos son posteriores. */
function lastAtOrBefore(points: TPoint[], t: number): number {
	let lo = 0;
	let hi = points.length - 1;
	let ans = -1;
	while (lo <= hi) {
		const mid = (lo + hi) >> 1;
		if (points[mid].t <= t) {
			ans = mid;
			lo = mid + 1;
		} else hi = mid - 1;
	}
	return ans;
}

/** El último valor conocido en el instante `t` (el cierre anterior), o null si aún no había datos. */
export function valueAt(points: TPoint[], t: number): TPoint | null {
	const i = lastAtOrBefore(points, t);
	return i < 0 ? null : points[i];
}

/** Los puntos que se ven, con uno más a cada lado para que la línea llegue al borde. */
export function visible(points: TPoint[], domain: Domain): TPoint[] {
	if (!points.length) return [];
	const a = Math.max(0, lastAtOrBefore(points, domain[0]));
	let b = lastAtOrBefore(points, domain[1]);
	b = Math.min(points.length - 1, b + 1);
	return b < a ? [] : points.slice(a, b + 1);
}

/** Variación (%) entre el primer y el último valor dentro del dominio; null si no hay dos. */
export function change(points: TPoint[], domain: Domain): number | null {
	const first = points.find((p) => p.t >= domain[0] && p.t <= domain[1]);
	const last = valueAt(points, domain[1]);
	if (!first || !last || last.t <= first.t || first.v === 0) return null;
	return ((last.v - first.v) / Math.abs(first.v)) * 100;
}

/**
 * Trazo SVG (escalones: el valor se mantiene hasta el siguiente cierre) de los puntos visibles, con el eje
 * vertical ajustado a su mínimo y máximo dentro de [y0, y0 + h]. El último valor se alarga hasta `until`
 * («ahora»), nunca hacia el futuro. Vacío si no hay puntos.
 */
export function stepPath(points: TPoint[], sc: Scale, y0: number, h: number, until?: number): string {
	const pts = visible(points, sc.domain);
	if (!pts.length) return '';
	let min = Infinity;
	let max = -Infinity;
	for (const p of pts) {
		if (p.v < min) min = p.v;
		if (p.v > max) max = p.v;
	}
	const span = max - min || Math.abs(max) || 1;
	const y = (v: number) => y0 + h - ((v - min) / span) * h;
	const [r0, r1] = sc.range;
	const cx = (x: number) => Math.max(r0, Math.min(r1, x));
	const r = (n: number) => Math.round(n * 10) / 10;
	let d = `M${r(cx(sc.x(pts[0].t)))},${r(y(pts[0].v))}`;
	for (let i = 1; i < pts.length; i++) {
		const x = r(cx(sc.x(pts[i].t)));
		d += `H${x}V${r(y(pts[i].v))}`;
	}
	const end = Math.max(pts[pts.length - 1].t, until ?? pts[pts.length - 1].t);
	return d + `H${r(cx(sc.x(end)))}`;
}
