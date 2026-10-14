import { dataset } from '#lib/data.ts';
import type { Chokepoint, Disaster, HazardsData, NewsData, PredictionsData, Quake } from '#lib/types.ts';
import type { TradeLike } from '#lib/geo/layers.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	const [news, gov, quakes, quakesEs, hazards, predictions, portwatch, reliefweb, sanctions] = await Promise.all([
		dataset<NewsData>('news-geo'),
		dataset<NewsData>('news-gov'),
		dataset<Quake[]>('quakes'),
		dataset<Quake[]>('quakes-es'),
		dataset<HazardsData>('hazards'),
		dataset<PredictionsData>('predictions'),
		dataset<Chokepoint[]>('portwatch'),
		dataset<Disaster[]>('reliefweb'),
		// Sanciones y aranceles (scripts/sources/sanctions.ts), para la capa del mapa.
		dataset<TradeLike[]>('sanctions')
	]);
	return { news, gov, quakes, quakesEs, hazards, predictions, portwatch, reliefweb, sanctions };
};
