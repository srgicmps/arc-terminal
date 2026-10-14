import { dataset } from '#lib/data.ts';
import type { Chokepoint, HazardsData, NewsData, PredictionsData, Quake } from '#lib/types.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	const [news, gov, quakes, quakesEs, hazards, predictions, portwatch] = await Promise.all([
		dataset<NewsData>('news-geo'),
		dataset<NewsData>('news-gov'),
		dataset<Quake[]>('quakes'),
		dataset<Quake[]>('quakes-es'),
		dataset<HazardsData>('hazards'),
		dataset<PredictionsData>('predictions'),
		dataset<Chokepoint[]>('portwatch')
	]);
	return { news, gov, quakes, quakesEs, hazards, predictions, portwatch };
};
