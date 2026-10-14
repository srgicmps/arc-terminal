// Ordenar las filas de una tabla por una columna (cabeceras SortTh). Los vacíos (null, undefined, NaN) van
// siempre al final, se ordene hacia arriba o hacia abajo; los textos, en orden alfabético español.

export type SortDir = 'asc' | 'desc';
export type SortValue = number | string | null | undefined;

export function sortBy<T>(rows: readonly T[], value: (row: T) => SortValue, dir: SortDir): T[] {
	const sign = dir === 'asc' ? 1 : -1;
	const empty = (v: SortValue) => v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v));
	return [...rows].sort((a, b) => {
		const x = value(a);
		const y = value(b);
		if (empty(x) || empty(y)) return empty(x) === empty(y) ? 0 : empty(x) ? 1 : -1;
		if (typeof x === 'string' || typeof y === 'string') return sign * String(x).localeCompare(String(y), 'es');
		return sign * ((x as number) - (y as number));
	});
}
