import { dataset } from '#lib/data.ts';
import { NEWS_SECTIONS as SECTIONS } from '#lib/news.ts';
import type { NewsData } from '#lib/types.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const sets = await Promise.all(SECTIONS.map((s) => dataset<NewsData>(`news-${s.key}`)));
	const items = SECTIONS.flatMap((s, i) => (sets[i]?.data.items ?? []).map((item) => ({ ...item, section: s.key })));
	items.sort((a, b) => (b.time ?? '').localeCompare(a.time ?? ''));
	return { items };
};
