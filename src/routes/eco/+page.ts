import { dataset, type SourceStatus } from '#lib/data.ts';
import type { ImfData, NewsData, PredictionsData, SeriesData } from '#lib/types.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	const [eurostat, ecb, bls, usdebt, fred, bis, imf, news, predictions, status] = await Promise.all([
		dataset<SeriesData>('eurostat'),
		dataset<SeriesData>('ecb'),
		dataset<SeriesData>('bls'),
		dataset<SeriesData>('usdebt'),
		dataset<SeriesData>('fred'),
		dataset<SeriesData>('bis'),
		dataset<ImfData>('imf'),
		dataset<NewsData>('news-eco'),
		dataset<PredictionsData>('predictions'),
		dataset<SourceStatus[]>('status')
	]);
	return { eurostat, ecb, bls, usdebt, fred, bis, imf, news, predictions, status };
};
