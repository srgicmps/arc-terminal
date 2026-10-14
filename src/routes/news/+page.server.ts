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
	return { items, months: archive?.data.months ?? [] };
};
