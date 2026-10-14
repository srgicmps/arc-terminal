// Recortes de los datos antes de mandarlos al navegador. Los usan los +page.server.ts: al construir la web
// leen el JSON entero, pero cada vista solo recibe lo que pinta (menos datos en el móvil).
import type { Dataset } from './data.ts';
import type { NewsData, SeriesData } from './types.ts';

/** El mismo dataset con `data` transformado (fetchedAt y name se quedan igual). */
export function trim<T>(set: Dataset<T> | null, f: (data: T) => T): Dataset<T> | null {
	return set ? { ...set, data: f(set.data) } : null;
}

/**
 * Solo las series con esos ids y, si se indica, solo sus últimos `tail` puntos
 * (para tablas con minigráfico, que no necesitan años de historia).
 */
export function pickSeries(set: Dataset<SeriesData> | null, ids: string[] | null, tail?: number) {
	return trim(set, (d) => ({
		series: d.series
			.filter((s) => !ids || ids.includes(s.id))
			.map((s) => (tail ? { ...s, points: s.points.slice(-tail) } : s))
	}));
}

/** Los primeros `count` titulares; sin el resumen si la vista no lo enseña. Sin el estado de los canales. */
export function headlines(set: Dataset<NewsData> | null, count: number, summaries = false) {
	return trim(set, (d) => ({
		items: d.items.slice(0, count).map((i) => (summaries ? i : { ...i, summary: '' })),
		feeds: d.feeds
	}));
}
