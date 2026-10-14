import { dataset } from '#lib/data.ts';
import type { CryptoData, NewsData, PredictionsData, SeriesData, YieldCurveData } from '#lib/types.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	const [news, curve, ecb, crypto, fred, predictions] = await Promise.all([
		dataset<NewsData>('news-ws'),
		dataset<YieldCurveData>('uscurve'),
		dataset<SeriesData>('ecb'),
		dataset<CryptoData>('crypto'),
		// Para el termómetro de riesgo.
		dataset<SeriesData>('fred'),
		dataset<PredictionsData>('predictions')
	]);
	return { news, curve, ecb, crypto, fred, predictions };
};
