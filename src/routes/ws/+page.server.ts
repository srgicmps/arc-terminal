import { dataset } from '#lib/data.ts';
import { pickSeries } from '#lib/trim.ts';
import type { CryptoData, NewsData, SeriesData, YieldCurveData } from '#lib/types.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [news, curve, ecb, crypto] = await Promise.all([
		dataset<NewsData>('news-ws'),
		dataset<YieldCurveData>('uscurve'),
		dataset<SeriesData>('ecb'),
		dataset<CryptoData>('crypto')
	]);
	// Del BCE solo hacen falta los tipos de cambio, y de cada uno los últimos 60 días del minigráfico (más el anterior).
	const fx = ['eurusd', 'eurgbp', 'eurjpy', 'eurchf', 'eurcny', 'eurmxn'];
	return { news, curve, ecb: pickSeries(ecb, fx, 61), crypto };
};
