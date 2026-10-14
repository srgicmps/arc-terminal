import { dataset } from '#lib/data.ts';
import { trimCurve } from '#lib/curves.ts';
import { pickSeries, trim } from '#lib/trim.ts';
import type { CryptoData, NewsData, SeriesData, YieldCurveData } from '#lib/types.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [news, curve, eacurve, jgb, ecb, crypto] = await Promise.all([
		dataset<NewsData>('news-ws'),
		dataset<YieldCurveData>('uscurve'),
		dataset<YieldCurveData>('eacurve'),
		dataset<YieldCurveData>('jgb'),
		dataset<SeriesData>('ecb'),
		dataset<CryptoData>('crypto')
	]);
	// Del BCE solo hacen falta los tipos de cambio, y de cada uno los últimos 60 días del minigráfico (más el anterior).
	const fx = ['eurusd', 'eurgbp', 'eurjpy', 'eurchf', 'eurcny', 'eurmxn'];
	// De cada curva, solo hoy, hace una semana y hace un año (son más de 250 días cada una).
	return {
		news,
		curve: trim(curve, trimCurve),
		eacurve: trim(eacurve, trimCurve),
		jgb: trim(jgb, trimCurve),
		ecb: pickSeries(ecb, fx, 61),
		crypto
	};
};
