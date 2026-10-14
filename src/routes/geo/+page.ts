import { dataset } from '#lib/data.ts';
import type { HazardsData, NewsData, PredictionsData, Quake } from '#lib/types.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	const [news, gov, gdelt, quakes, quakesEs, hazards, predictions] = await Promise.all([
		dataset<NewsData>('news-geo'),
		dataset<NewsData>('news-gov'),
		dataset<NewsData>('gdelt'),
		dataset<Quake[]>('quakes'),
		dataset<Quake[]>('quakes-es'),
		dataset<HazardsData>('hazards'),
		dataset<PredictionsData>('predictions')
	]);
	return { news, gov, gdelt, quakes, quakesEs, hazards, predictions };
};
