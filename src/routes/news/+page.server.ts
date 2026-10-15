import { dataset } from '#lib/data.ts';
import { NEWS_SECTIONS as SECTIONS } from '#lib/news.ts';
import type { NewsArchive, NewsData } from '#lib/types.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [sets, archive] = await Promise.all([
		Promise.all(SECTIONS.map((s) => dataset<NewsData>(`news-${s.key}`))),
		// Solo el índice (meses y peso): los titulares de cada mes se piden al buscar (ver +page.svelte).
		dataset<NewsArchive>('news-archive')
	]);
	const items = SECTIONS.flatMap((s, i) => (sets[i]?.data.items ?? []).map((item) => ({ ...item, section: s.key })));
	items.sort((a, b) => (b.time ?? '').localeCompare(a.time ?? ''));
	// La descarga de titulares más reciente (cada sección es un JSON): para el «Act. hace…» de los resultados.
	const newest = SECTIONS.map((s, i) => ({ source: `news-${s.key}`, at: sets[i]?.fetchedAt }))
		.filter((u): u is { source: string; at: string } => !!u.at)
		.sort((a, b) => b.at.localeCompare(a.at))[0];
	return { items, months: archive?.data.months ?? [], updated: newest ?? null };
};
