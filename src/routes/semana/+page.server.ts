// SEMANA: el resumen se calcula al construir la web (cada 15 min); al navegador solo le llega el resultado.
import { dataset } from '#lib/data.ts';
import { seriesMap } from '#lib/series.ts';
import type { CryptoData, ImpData, ReleaseCalData, SeriesData, YieldCurveData } from '#lib/types.ts';
import { dailySeries, weekSummary } from '#lib/week.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [imp, fred, ecb, curve, crypto, releases] = await Promise.all([
		dataset<ImpData>('imp'),
		dataset<SeriesData>('fred'),
		dataset<SeriesData>('ecb'),
		dataset<YieldCurveData>('uscurve'),
		dataset<CryptoData>('crypto'),
		dataset<ReleaseCalData>('releases-cal')
	]);
	const get = seriesMap(fred, ecb);
	const ten = curve?.data.tenors.indexOf('10A') ?? -1;
	const summary = weekSummary({
		imp: imp?.data,
		releases: releases?.data,
		markets: [
			{ label: 'EUR/USD', series: get('eurusd'), kind: 'pct', decimals: 4 },
			{ label: 'Dólar, índice amplio', series: get('dollar-broad'), kind: 'pct' },
			{ label: 'Bono de EE. UU. a 10 años (%)', kind: 'pb', series: ten < 0 ? undefined : dailySeries('us10y', '10 años', '%', 'Tesoro de EE. UU.', (curve?.data.days ?? []).map((d) => ({ date: d.date, v: d.values[ten] }))) },
			{ label: 'Petróleo WTI ($)', series: get('wti'), kind: 'pct' },
			{ label: 'VIX', series: get('vix'), kind: 'pct' },
			{ label: 'Bitcoin ($)', kind: 'pct', decimals: 0, series: dailySeries('btc', 'Bitcoin', '$', 'CoinGecko', (crypto?.data.btcHistory ?? []).map((d) => ({ date: d.date, v: d.usd }))) }
		]
	});
	return { summary, impAt: imp?.fetchedAt, releasesAt: releases?.fetchedAt };
};
