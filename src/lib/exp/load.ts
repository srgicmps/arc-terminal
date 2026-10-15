// Cargas compartidas por las experiencias. Solo para los +page.server.ts (usan dataset(), que se ejecuta al
// construir): al navegador llega el resultado ya recortado.
import { dataset } from '../data.ts';
import { seriesMap } from '../series.ts';
import { pickSeries } from '../trim.ts';
import type { ImpData, SeriesData } from '../types.ts';
import { FIGURE_SERIES, figures } from './figures.ts';

/** Las cifras del día (figures.ts) con los últimos datos de BCE, Eurostat, BLS y FRED. */
export async function loadFigures() {
	const sets = await Promise.all(['ecb', 'eurostat', 'bls', 'fred'].map((n) => dataset<SeriesData>(n)));
	return figures(seriesMap(...sets.map((d) => pickSeries(d, FIGURE_SERIES, 3))));
}

/** Los temas de más peso de IMP ahora mismo, con lo justo para pintarlos. */
export async function loadTop(n: number) {
	const imp = await dataset<ImpData>('imp');
	return {
		fetchedAt: imp?.fetchedAt ?? null,
		top: (imp?.data.current ?? []).slice(0, n).map(({ k, title, titleEs, lang, url, sources, sections, time }) => ({ k, title, titleEs, lang, url, sources, sections, time }))
	};
}
