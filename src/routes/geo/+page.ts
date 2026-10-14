import { dataset } from '#lib/data.ts';
import type { Chokepoint, Disaster, HazardsData, NewsData, PredictionsData, Quake, SwpcData, TradeDoc } from '#lib/types.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	const [news, gov, quakes, quakesEs, hazards, predictions, portwatch, reliefweb, sanctions, swpc] = await Promise.all([
		dataset<NewsData>('news-geo'),
		dataset<NewsData>('news-gov'),
		dataset<Quake[]>('quakes'),
		dataset<Quake[]>('quakes-es'),
		dataset<HazardsData>('hazards'),
		dataset<PredictionsData>('predictions'),
		dataset<Chokepoint[]>('portwatch'),
		dataset<Disaster[]>('reliefweb'),
		dataset<TradeDoc[]>('sanctions'),
		dataset<SwpcData>('swpc')
	]);
	return { news, gov, quakes, quakesEs, hazards, predictions, portwatch, reliefweb, sanctions, swpc };
};
