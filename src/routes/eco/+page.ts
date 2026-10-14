import { dataset } from '#lib/data.ts';
import type { G20Data, ImfData, NewsData, PredictionsData, SeriesData } from '#lib/types.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	const [eurostat, ecb, bls, usdebt, fred, bis, imf, g20, news, predictions] = await Promise.all([
		dataset<SeriesData>('eurostat'),
		dataset<SeriesData>('ecb'),
		dataset<SeriesData>('bls'),
		dataset<SeriesData>('usdebt'),
		dataset<SeriesData>('fred'),
		dataset<SeriesData>('bis'),
		dataset<ImfData>('imf'),
		dataset<G20Data>('oecd'),
		dataset<NewsData>('news-eco'),
		dataset<PredictionsData>('predictions')
	]);
	return { eurostat, ecb, bls, usdebt, fred, bis, imf, g20, news, predictions };
};
