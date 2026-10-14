import { dataset } from '#lib/data.ts';
import type { HnItem, KevData, NewsData, Release } from '#lib/types.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [news, hn, releases, kev] = await Promise.all([
		dataset<NewsData>('news-tech'),
		dataset<HnItem[]>('hn'),
		dataset<Release[]>('releases'),
		dataset<KevData>('cisa-kev')
	]);
	return { news, hn, releases, kev };
};
