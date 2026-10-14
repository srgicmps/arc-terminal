import { dataset } from '#lib/data.ts';
import type { ClimateData } from '#lib/climate.ts';
import type { Chokepoint, Disaster, HazardsData, NewsData, PredictionsData, Quake, TradeDoc } from '#lib/types.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	const [news, gov, quakes, quakesEs, hazards, predictions, portwatch, reliefweb, sanctions, climate] = await Promise.all([
		dataset<NewsData>('news-geo'),
		dataset<NewsData>('news-gov'),
		dataset<Quake[]>('quakes'),
		dataset<Quake[]>('quakes-es'),
		dataset<HazardsData>('hazards'),
		dataset<PredictionsData>('predictions'),
		dataset<Chokepoint[]>('portwatch'),
		dataset<Disaster[]>('reliefweb'),
		dataset<TradeDoc[]>('sanctions'),
		dataset<ClimateData>('climate')
	]);
	return { news, gov, quakes, quakesEs, hazards, predictions, portwatch, reliefweb, sanctions, climate };
};
