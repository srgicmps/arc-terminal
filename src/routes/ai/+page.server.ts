import { dataset } from '#lib/data.ts';
import type { HnItem, NewsData, Paper } from '#lib/types.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [news, hn, papers] = await Promise.all([
		dataset<NewsData>('news-ai'),
		dataset<HnItem[]>('hn'),
		dataset<Paper[]>('hfpapers')
	]);
	return { news, hn, papers };
};
