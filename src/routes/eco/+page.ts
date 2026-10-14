import { dataset } from '#lib/data.ts';
import type { NewsData, PredictionsData, SeriesData } from '#lib/types.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	const [eurostat, ecb, bls, usdebt, news, predictions] = await Promise.all([
		dataset<SeriesData>('eurostat'),
		dataset<SeriesData>('ecb'),
		dataset<SeriesData>('bls'),
		dataset<SeriesData>('usdebt'),
		dataset<NewsData>('news-eco'),
		dataset<PredictionsData>('predictions')
	]);
	return { eurostat, ecb, bls, usdebt, news, predictions };
};
