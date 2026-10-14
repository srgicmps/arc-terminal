// Ayudantes para trabajar con las series de static/data (BCE, Eurostat, BLS, Tesoro).
import type { Dataset } from './data.ts';
import type { Point, Series, SeriesData } from './types.ts';

/** Junta las series de varios archivos en un mapa por id: get('unemployment-es'). */
export function seriesMap(...sets: (Dataset<SeriesData> | null)[]) {
	const map = new Map<string, Series>();
	for (const set of sets) for (const s of set?.data.series ?? []) map.set(s.id, s);
	return (id: string) => map.get(id);
}

export function last(s: Series | undefined): Point | undefined {
	return s?.points[s.points.length - 1];
}

/** Valor de la serie en la fecha más cercana anterior o igual a `t`. */
export function at(s: Series | undefined, t: string): Point | undefined {
	if (!s) return undefined;
	let found: Point | undefined;
	for (const p of s.points) if (p.t <= t) found = p;
	return found;
}

/** Serie diferencia a − b en puntos básicos, con los periodos comunes (prima de riesgo). */
export function spread(a: Series | undefined, b: Series | undefined, id: string, label: string): Series | undefined {
	if (!a || !b) return undefined;
	const bm = new Map(b.points.map((p) => [p.t, p.v]));
	const points = a.points.flatMap((p) => {
		const v = bm.get(p.t);
		return v === undefined ? [] : [{ t: p.t, v: Math.round((p.v - v) * 100) }];
	});
	return { id, label, unit: 'pb', geo: a.geo, points, source: a.source, url: a.url };
}

/** Variación porcentual entre el último punto y el de hace `n` puntos. */
export function change(s: Series | undefined, n = 1): number | null {
	if (!s || s.points.length <= n) return null;
	const a = s.points[s.points.length - 1 - n].v;
	const b = s.points[s.points.length - 1].v;
	return a ? ((b - a) / a) * 100 : null;
}
