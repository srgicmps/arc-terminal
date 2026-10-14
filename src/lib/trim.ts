// Recortes de los datos antes de mandarlos al navegador. Los usan los +page.server.ts: al construir la web
// leen el JSON entero, pero cada vista solo recibe lo que pinta (menos datos en el móvil).
import type { Dataset } from './data.ts';
import type { EuLexDoc, NewsData, SeriesData } from './types.ts';

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

/** Actos que enseña el panel del Diario Oficial de la UE (vista BOE), en total o por tema. */
export const EU_SHOWN = 40;

/**
 * Actos del Diario Oficial de la UE (BOE): los `count` primeros y los `count` primeros de cada tema, que es
 * todo lo que puede enseñar el panel con su filtro. En el mismo orden que vienen (lo más reciente primero).
 */
export function euLexShown(docs: EuLexDoc[], count: number): EuLexDoc[] {
	const keep = new Set(docs.slice(0, count).map((d) => d.id));
	for (const tag of new Set(docs.flatMap((d) => d.tags))) {
		for (const d of docs.filter((x) => x.tags.includes(tag)).slice(0, count)) keep.add(d.id);
	}
	return docs.filter((d) => keep.has(d.id));
}
