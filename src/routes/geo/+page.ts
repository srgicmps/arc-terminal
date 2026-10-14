import { dataset } from '#lib/data.ts';
import type { Disaster, HazardsData, NewsData, PredictionsData, Quake, TradeDoc } from '#lib/types.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	const [news, gov, quakes, quakesEs, hazards, predictions, reliefweb, sanctions] = await Promise.all([
		dataset<NewsData>('news-geo'),
		dataset<NewsData>('news-gov'),
		dataset<Quake[]>('quakes'),
		dataset<Quake[]>('quakes-es'),
		dataset<HazardsData>('hazards'),
		dataset<PredictionsData>('predictions'),
		dataset<Disaster[]>('reliefweb'),
		dataset<TradeDoc[]>('sanctions')
	]);
	return { news, gov, quakes, quakesEs, hazards, predictions, reliefweb, sanctions };
};
