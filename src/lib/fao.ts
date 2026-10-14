// Índice FAO de precios de los alimentos: lectura de los datos mensuales de la FAO como una matriz de
// celdas (scripts/sources/fao.ts parte el CSV). Pura, para poder probarla.
import type { Series } from './types.ts';

export interface FaoData {
	/** El índice general y sus 5 subíndices, mensuales (2014–2016 = 100), del más antiguo al más reciente. */
	series: Series[];
	/** Fecha de publicación del último dato, si la página la da: «2026-10-03». */
	released: string | null;
}

/** Cada serie y cómo reconocer su columna en la cabecera (en inglés, como la escribe la FAO). */
export const FAO_SERIES = [
	{ id: 'food', label: 'Índice general', match: /food price index/i },
	{ id: 'cereals', label: 'Cereales', match: /cereal/i },
	{ id: 'oils', label: 'Aceites vegetales', match: /oil/i },
	{ id: 'meat', label: 'Carne', match: /meat/i },
	{ id: 'dairy', label: 'Lácteos', match: /dairy/i },
	{ id: 'sugar', label: 'Azúcar', match: /sugar/i }
] as const;

const URL = 'https://www.fao.org/worldfoodsituation/foodpricesindex/en/';

/** El mes de una celda de fecha: un Date, «2026-09», «2026-09-01» o «09/2026». Si no lo es, null. */
export function monthOf(cell: unknown): string | null {
	if (cell instanceof Date && !Number.isNaN(cell.getTime())) return cell.toISOString().slice(0, 7);
	const s = String(cell ?? '').trim();
	let m = /^(\d{4})-(\d{1,2})(-\d{1,2})?$/.exec(s);
	if (m) return `${m[1]}-${m[2].padStart(2, '0')}`;
	m = /^(\d{1,2})\/(\d{4})$/.exec(s);
	if (m) return `${m[2]}-${m[1].padStart(2, '0')}`;
	return null;
}

/**
 * Busca la fila de cabecera y lee las filas de debajo que empiezan por
 * un mes. Toma la primera columna que encaja con cada serie: en la hoja de la FAO, la de valores nominales.
 */
export function parseFaoSheet(cells: unknown[][]): Series[] {
	const text = (c: unknown) => String(c ?? '').replace(/\s+/g, ' ').trim();
	// La cabecera es la fila que nombra casi todas las series (el título también dice «Food Price Index»).
	const head = cells.findIndex((r) => FAO_SERIES.filter((s) => r.some((c) => s.match.test(text(c)))).length >= 4);
	if (head < 0) return [];
	const header = cells[head].map(text);
	// «Food Price Index» también encaja con otras reglas: se aparta antes de buscar los subíndices.
	const taken = new Set<number>();
	const columns = FAO_SERIES.map((s) => {
		const i = header.findIndex((h, j) => !taken.has(j) && s.match.test(h));
		if (i >= 0) taken.add(i);
		return i;
	});
	const points = FAO_SERIES.map(() => [] as { t: string; v: number }[]);
	for (const row of cells.slice(head + 1)) {
		const t = row.map(monthOf).find(Boolean);
		if (!t) continue;
		columns.forEach((col, k) => {
			const v = col >= 0 ? Number(row[col]) : NaN;
			if (row[col] !== null && row[col] !== '' && Number.isFinite(v) && v > 0) points[k].push({ t, v });
		});
	}
	return FAO_SERIES.flatMap((s, k) => {
		const pts = [...new Map(points[k].map((p) => [p.t, p])).values()].sort((a, b) => a.t.localeCompare(b.t));
		return pts.length ? [{ id: `fao-${s.id}`, label: s.label, unit: 'índice', points: pts, source: 'FAO', url: URL }] : [];
	});
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

/**
 * «Release date: 03/10/2026» o «Release date: 3 October 2026» en la página de la FAO → «2026-10-03».
 * Con los dos puntos: antes, la página dice «Next release dates for 2026: 9 January, …».
 */
export function releaseDate(html: string): string | null {
	const near = /Release date:(?:\s|&nbsp;|<[^>]*>)*([^<]{0,40})/i.exec(html)?.[1] ?? '';
	let m = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(near);
	if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
	m = /(\d{1,2}) ([a-z]+) (\d{4})/i.exec(near);
	const month = m ? MONTHS.indexOf(m[2].toLowerCase()) : -1;
	if (m && month >= 0) return `${m[3]}-${String(month + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
	return null;
}
