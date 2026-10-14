import { dataset } from '#lib/data.ts';
import type { FaoData } from '#lib/fao.ts';
import type { ImfData, NewsData, PredictionsData, SeriesData } from '#lib/types.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	const [eurostat, ecb, bls, usdebt, fred, bis, imf, news, predictions, fao] = await Promise.all([
		dataset<SeriesData>('eurostat'),
		dataset<SeriesData>('ecb'),
		dataset<SeriesData>('bls'),
		dataset<SeriesData>('usdebt'),
		dataset<SeriesData>('fred'),
		dataset<SeriesData>('bis'),
		dataset<ImfData>('imf'),
		dataset<NewsData>('news-eco'),
		dataset<PredictionsData>('predictions'),
		dataset<FaoData>('fao')
	]);
	return { eurostat, ecb, bls, usdebt, fred, bis, imf, news, predictions, fao };
};
