// Periódico: la portada de IMP como titulares, las secciones de NEWS y las cifras del día como breves. Se recorta
// aquí (al construir): al navegador solo llega lo que se pinta.
import { dataset } from '#lib/data.ts';
import { FIGURE_SERIES, figures } from '#lib/exp/figures.ts';
import { seriesMap } from '#lib/series.ts';
import { pickSeries } from '#lib/trim.ts';
import type { ImpData, NewsData, NewsItem, SeriesData } from '#lib/types.ts';
import type { PageServerLoad } from './$types';

/** Secciones del diario y de qué titulares salen (static/data/news-<clave>.json). */
const SECTIONS = [
	{ id: 'mundo', label: 'Mundo', from: ['geo', 'world'], view: '/geo' },
	{ id: 'eco', label: 'Economía', from: ['eco'], view: '/eco' },
	{ id: 'es', label: 'España', from: ['es'], view: '/es' },
	{ id: 'mercados', label: 'Mercados', from: ['ws'], view: '/ws' },
	{ id: 'tec', label: 'Tecnología', from: ['tech', 'ai'], view: '/tech' }
] as const;

/** Por sección: los de las últimas ~36 h, con margen para las dos ediciones. */
const PER_SECTION = 24;

const slim = (i: NewsItem) => ({ title: i.title, titleEs: i.titleEs, lang: i.lang, url: i.url, source: i.source, time: i.time, summary: i.summary.slice(0, 240) });

export const load: PageServerLoad = async () => {
	const keys = [...new Set(SECTIONS.flatMap((s) => s.from))];
	const [news, imp, ecb, eurostat, bls, fred] = await Promise.all([
		Promise.all(keys.map((k) => dataset<NewsData>(`news-${k}`))),
		dataset<ImpData>('imp'),
		dataset<SeriesData>('ecb'),
		dataset<SeriesData>('eurostat'),
		dataset<SeriesData>('bls'),
		dataset<SeriesData>('fred')
	]);
	const byKey = new Map(keys.map((k, i) => [k, news[i]?.data.items ?? []]));
	const tail = (d: typeof ecb) => pickSeries(d, FIGURE_SERIES, 3);
	const get = seriesMap(tail(ecb), tail(eurostat), tail(bls), tail(fred));

	return {
		fetchedAt: imp?.fetchedAt ?? null,
		// Los temas de más peso ahora mismo: el primero abre el periódico.
		top: (imp?.data.current ?? []).slice(0, 7).map(({ k, title, titleEs, lang, url, sources, sections, time }) => ({ k, title, titleEs, lang, url, sources, sections, time })),
		sections: SECTIONS.map((s) => {
			const seen = new Set<string>();
			const items = s.from
				.flatMap((k) => byKey.get(k) ?? [])
				.filter((i) => (seen.has(i.url) ? false : (seen.add(i.url), true)))
				.sort((a, b) => (b.time ?? '').localeCompare(a.time ?? ''))
				.slice(0, PER_SECTION)
				.map(slim);
			return { id: s.id, label: s.label, view: s.view, items };
		}),
		figures: figures(get)
	};
};
