import { dataset } from '#lib/data.ts';
import type { Chokepoint, Disaster, HazardsData, NewsData, PredictionsData, Quake, TradeDoc } from '#lib/types.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	const [news, gov, intl, quakes, quakesEs, hazards, predictions, portwatch, reliefweb, sanctions] = await Promise.all([
		dataset<NewsData>('news-geo'),
		dataset<NewsData>('news-gov'),
		dataset<NewsData>('news-intl'),
		dataset<Quake[]>('quakes'),
		dataset<Quake[]>('quakes-es'),
		dataset<HazardsData>('hazards'),
		dataset<PredictionsData>('predictions'),
		dataset<Chokepoint[]>('portwatch'),
		dataset<Disaster[]>('reliefweb'),
		dataset<TradeDoc[]>('sanctions')
	]);
	return { news, gov, intl, quakes, quakesEs, hazards, predictions, portwatch, reliefweb, sanctions };
};
