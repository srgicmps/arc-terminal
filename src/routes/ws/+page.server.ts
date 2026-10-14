import { dataset } from '#lib/data.ts';
import { trimCurve } from '#lib/curves.ts';
import { pickSeries, trim } from '#lib/trim.ts';
import { computeRisk } from '#lib/risk.ts';
import type { CryptoData, NewsData, PredictionsData, SeriesData, YieldCurveData } from '#lib/types.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [news, curve, eacurve, jgb, ecb, crypto, fred, predictions] = await Promise.all([
		dataset<NewsData>('news-ws'),
		dataset<YieldCurveData>('uscurve'),
		dataset<YieldCurveData>('eacurve'),
		dataset<YieldCurveData>('jgb'),
		dataset<SeriesData>('ecb'),
		dataset<CryptoData>('crypto'),
		dataset<SeriesData>('fred'),
		dataset<PredictionsData>('predictions')
	]);
	// El termómetro de riesgo se calcula aquí, al construir: al navegador solo llega el resultado y su desglose.
	const risk = computeRisk({ fred: fred?.data, ecb: ecb?.data, crypto: crypto?.data, predictions: predictions?.data });
	// Del BCE solo hacen falta los tipos de cambio, y de cada uno los últimos 60 días del minigráfico (más el anterior).
	const fx = ['eurusd', 'eurgbp', 'eurjpy', 'eurchf', 'eurcny', 'eurmxn'];
	// De cada curva, solo hoy, hace una semana y hace un año (son más de 250 días cada una).
	return {
		news,
		curve: trim(curve, trimCurve),
		eacurve: trim(eacurve, trimCurve),
		jgb: trim(jgb, trimCurve),
		ecb: pickSeries(ecb, fx, 61),
		// El historial de bitcoin solo sirve para el termómetro.
		crypto: crypto && { ...crypto, data: { coins: crypto.data.coins } },
		risk
	};
};
