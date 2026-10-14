import { dataset } from '#lib/data.ts';
import type { HnItem, NewsData, Release } from '#lib/types.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [news, hn, releases] = await Promise.all([
		dataset<NewsData>('news-tech'),
		dataset<HnItem[]>('hn'),
		dataset<Release[]>('releases')
	]);
	return { news, hn, releases };
};
