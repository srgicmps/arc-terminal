import { dataset } from '#lib/data.ts';
import type { BoeData, NewsData, PowerData } from '#lib/types.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	const [news, gov, boe, power] = await Promise.all([
		dataset<NewsData>('news-es'),
		dataset<NewsData>('news-gov'),
		dataset<BoeData>('boe'),
		dataset<PowerData>('power')
	]);
	return { news, gov, boe, power };
};
