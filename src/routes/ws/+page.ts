import { dataset } from '#lib/data.ts';
import type { CryptoData, NewsData, SeriesData, YieldCurveData } from '#lib/types.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	const [news, curve, ecb, crypto] = await Promise.all([
		dataset<NewsData>('news-ws'),
		dataset<YieldCurveData>('uscurve'),
		dataset<SeriesData>('ecb'),
		dataset<CryptoData>('crypto')
	]);
	return { news, curve, ecb, crypto };
};
