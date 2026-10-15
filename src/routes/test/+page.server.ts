// TEST (F24): las preguntas se hacen al construir la web (src/lib/quiz.ts); al navegador solo le llegan ellas.
import { dataset } from '#lib/data.ts';
import { buildQuiz } from '#lib/quiz.ts';
import { seriesMap } from '#lib/series.ts';
import type { CryptoData, ImpData, Quake, SeriesData, YieldCurveData } from '#lib/types.ts';
import { dailySeries, weekSummary } from '#lib/week.ts';
import type { PageServerLoad } from './$types';

/** Lo que se usa de f1.json y football.json (DEP): solo los nombres en orden y los puntos del primero. */
type Standings = { drivers?: { name: string; points: number }[]; competitions?: { code: string; table: { team: string; points: number }[] }[] };

export const load: PageServerLoad = async () => {
	const [imp, fred, ecb, curve, crypto, quakes, f1, football] = await Promise.all([
		dataset<ImpData>('imp'),
		dataset<SeriesData>('fred'),
		dataset<SeriesData>('ecb'),
		dataset<YieldCurveData>('uscurve'),
		dataset<CryptoData>('crypto'),
		dataset<Quake[]>('quakes'),
		dataset<Standings>('f1'),
		dataset<Standings>('football')
	]);
	const get = seriesMap(fred, ecb);
	const ten = curve?.data.tenors.indexOf('10A') ?? -1;
	// Las mismas cuentas que SEMANA, con nombres que se leen bien en una pregunta.
	const week = weekSummary({
		imp: imp?.data,
		releases: undefined,
		markets: [
			{ label: 'el euro frente al dólar', series: get('eurusd'), kind: 'pct', decimals: 4 },
			{ label: 'el petróleo (WTI)', series: get('wti'), kind: 'pct' },
			{ label: 'el índice del miedo en la bolsa (VIX)', series: get('vix'), kind: 'pct' },
			{ label: 'el bono de EE. UU. a 10 años', kind: 'pb', series: ten < 0 ? undefined : dailySeries('us10y', '10 años', '%', 'Tesoro de EE. UU.', (curve?.data.days ?? []).map((d) => ({ date: d.date, v: d.values[ten] }))) },
			{ label: 'el bitcoin', kind: 'pct', decimals: 0, series: dailySeries('btc', 'Bitcoin', '$', 'CoinGecko', (crypto?.data.btcHistory ?? []).map((d) => ({ date: d.date, v: d.usd }))) }
		]
	});
	const drivers = f1?.data.drivers ?? [];
	const liga = football?.data.competitions?.find((c) => c.code === 'PD')?.table ?? [];
	const leaders = [
		{ label: 'en LaLiga', names: liga.map((r) => r.team), explain: liga[0] ? `${liga[0].team}, con ${liga[0].points} puntos.` : '' },
		{ label: 'en el Mundial de Fórmula 1', names: drivers.map((d) => d.name), explain: drivers[0] ? `${drivers[0].name}, con ${drivers[0].points} puntos.` : '' }
	];
	const now = Date.parse(imp?.fetchedAt ?? '') || Date.now();
	return { quiz: buildQuiz({ top: week.top, markets: week.markets, quakes: quakes?.data ?? [], leaders }, now) };
};
