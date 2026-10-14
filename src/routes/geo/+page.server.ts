import { dataset } from '#lib/data.ts';
import { headlines, trim } from '#lib/trim.ts';
import type { Disaster, HazardsData, NewsData, PredictionsData, Quake } from '#lib/types.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [news, gov, quakes, quakesEs, hazards, predictions, reliefweb] = await Promise.all([
		dataset<NewsData>('news-geo'),
		dataset<NewsData>('news-gov'),
		dataset<Quake[]>('quakes'),
		dataset<Quake[]>('quakes-es'),
		dataset<HazardsData>('hazards'),
		dataset<PredictionsData>('predictions'),
		dataset<Disaster[]>('reliefweb')
	]);
	// Los comunicados oficiales: solo los 15 que se pintan, sin resumen.
	// De Polymarket, los 8 mercados de geopolítica que se pintan (economía y tipos son de ECO).
	return {
		news,
		gov: headlines(gov, 15),
		quakes,
		quakesEs,
		hazards,
		predictions: trim(predictions, (d) => ({ geopolitics: d.geopolitics.slice(0, 8), economy: [] })),
		reliefweb
	};
};
