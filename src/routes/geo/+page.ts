import { dataset } from '#lib/data.ts';
import type { NewsData, Quake } from '#lib/types.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	const [news, gov, quakes] = await Promise.all([
		dataset<NewsData>('news-geo'),
		dataset<NewsData>('news-gov'),
		dataset<Quake[]>('quakes')
	]);
	return { news, gov, quakes };
};
