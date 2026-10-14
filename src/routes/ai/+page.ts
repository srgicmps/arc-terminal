import { dataset } from '#lib/data.ts';
import type { HnItem, NewsData } from '#lib/types.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	const [news, hn] = await Promise.all([dataset<NewsData>('news-ai'), dataset<HnItem[]>('hn')]);
	return { news, hn };
};
