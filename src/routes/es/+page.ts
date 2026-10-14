import { dataset } from '#lib/data.ts';
import type { FuelSpainData } from '#lib/fuel.ts';
import type { BoeData, NewsData, PowerData, Quake, SeriesData } from '#lib/types.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	const [news, gov, boe, power, eurostat, ecb, fuel, quakes] = await Promise.all([
		dataset<NewsData>('news-es'),
		dataset<NewsData>('news-gov'),
		dataset<BoeData>('boe'),
		dataset<PowerData>('power'),
		dataset<SeriesData>('eurostat'),
		dataset<SeriesData>('ecb'),
		dataset<FuelSpainData>('fuel-es'),
		dataset<Quake[]>('quakes-es')
	]);
	return { news, gov, boe, power, eurostat, ecb, fuel, quakes };
};
