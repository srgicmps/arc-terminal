import { dataset } from '#lib/data.ts';
import type { HazardsData, NewsData, Quake } from '#lib/types.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	const [news, gov, gdelt, quakes, quakesEs, hazards] = await Promise.all([
		dataset<NewsData>('news-geo'),
		dataset<NewsData>('news-gov'),
		dataset<NewsData>('gdelt'),
		dataset<Quake[]>('quakes'),
		dataset<Quake[]>('quakes-es'),
		dataset<HazardsData>('hazards')
	]);
	return { news, gov, gdelt, quakes, quakesEs, hazards };
};
