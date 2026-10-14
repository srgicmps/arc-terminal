import { dataset } from '#lib/data.ts';
import { NEWS_SECTIONS as SECTIONS } from '#lib/news.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	const sets = await Promise.all(SECTIONS.map((s) => dataset(`news-${s.key}`)));
	const items = SECTIONS.flatMap((s, i) => (sets[i]?.data.items ?? []).map((item) => ({ ...item, section: s.key })));
	items.sort((a, b) => (b.time ?? '').localeCompare(a.time ?? ''));
	return { items };
};
