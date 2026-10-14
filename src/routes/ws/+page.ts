import { dataset } from '#lib/data.ts';
import type { CryptoData, NewsData, SeriesData, YieldCurveData } from '#lib/types.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	const [news, curve, eacurve, jgb, ecb, crypto] = await Promise.all([
		dataset<NewsData>('news-ws'),
		dataset<YieldCurveData>('uscurve'),
		dataset<YieldCurveData>('eacurve'),
		dataset<YieldCurveData>('jgb'),
		dataset<SeriesData>('ecb'),
		dataset<CryptoData>('crypto')
	]);
	return { news, curve, eacurve, jgb, ecb, crypto };
};
