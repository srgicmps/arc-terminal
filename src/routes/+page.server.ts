// Portada. Es +page.server.ts: se ejecuta al construir la web y el navegador solo recibe lo que se pinta
// (unos pocos titulares, las series de las tablas…), no los JSON enteros de cada sección.
import { REF_COUNTRIES } from '#lib/refcountry.svelte.ts';
import { dataset } from '#lib/data.ts';
import type { FuelData } from '#lib/fuel.ts';
import type { Puzzle } from '#lib/chess/puzzle.ts';
import { minus, topImportant } from '#lib/imp.ts';
import type { AlertsData } from '#lib/weather.ts';
import { madridDate } from '#lib/meetings.ts';
import { computeRisk } from '#lib/risk.ts';
import { seriesMap } from '#lib/series.ts';
import { dailySeries, weekSummary } from '#lib/week.ts';
import { pickSeries, trim } from '#lib/trim.ts';
import type {
	BoeData,
	CryptoData,
	FinnhubData,
	HolidaysData,
	HnItem,
	ImpData,
	NewsData,
	PowerData,
	PredictionsData,
	Quake,
	SeriesData,
	WeatherData
} from '#lib/types.ts';
import type { PageServerLoad } from './$types';

const SECTIONS = ['es', 'eco', 'geo', 'ws', 'tech', 'ai'] as const;
/** Las tablas de la portada dibujan como mucho 36 puntos (más el anterior, para la variación). */
const TAIL = 40;

export const load: PageServerLoad = async () => {
	const today = madridDate(Date.now());
	const tomorrow = minus(today, -1);
	const [news, ecb, eurostat, bls, crypto, power, weather, fuel, boe, quakes, hn, predictions, imp, finnhub, holidays, fred, lichess, alerts] = await Promise.all([
		Promise.all(SECTIONS.map((s) => dataset<NewsData>(`news-${s}`))),
		dataset<SeriesData>('ecb'),
		dataset<SeriesData>('eurostat'),
		dataset<SeriesData>('bls'),
		dataset<CryptoData>('crypto'),
		dataset<PowerData>('power'),
		dataset<WeatherData>('weather'),
		dataset<FuelData>('fuel'),
		dataset<BoeData>('boe'),
		dataset<Quake[]>('quakes'),
		dataset<HnItem[]>('hn'),
		dataset<PredictionsData>('predictions'),
		dataset<ImpData>('imp'),
		dataset<FinnhubData>('finnhub'),
		dataset<HolidaysData>('holidays'),
		dataset<SeriesData>('fred'),
		dataset<Puzzle>('lichess'),
		dataset<AlertsData>('alerts')
	]);

	// Titulares de portada: los 3 más recientes de cada sección, mezclados por hora (sin el resumen, que no se pinta).
	const headlines = SECTIONS.flatMap((section, i) =>
		(news[i]?.data.items ?? []).slice(0, 3).map((item) => ({ ...item, summary: '', section: section.toUpperCase() }))
	).sort((a, b) => (b.time ?? '').localeCompare(a.time ?? ''));

	return {
		headlines,
		headlinesTotal: news.reduce((n, d) => n + (d?.data.items.length ?? 0), 0),
		ecb: pickSeries(ecb, ['ecb-dfr', 'euribor-12m', 'bond10-es', 'bond10-de', 'eurusd', 'eurgbp', 'eurjpy'], TAIL),
		// Paro, inflación y deuda de cada país de referencia que se puede elegir en «Macro» (M22).
		eurostat: pickSeries(
			eurostat,
			[...REF_COUNTRIES.flatMap(({ code }) => ['unemployment', 'inflation', 'debt'].map((id) => `${id}-${code}`)), 'inflation-ea'],
			TAIL
		),
		bls: pickSeries(bls, ['cpi-us', 'unemployment-us'], TAIL),
		crypto: trim(crypto, (d) => ({ coins: d.coins.slice(0, 2) })),
		power: trim(power, (d) => ({ pvpc: d.pvpc, spot: [] })),
		// Todas las ciudades (para «Mi mañana» con la de «Tu sitio»), con solo hoy y mañana.
		weather: trim(weather, (d) => ({ places: d.places.map((p) => ({ ...p, daily: p.daily.slice(0, 2) })) })),
		// Avisos meteorológicos que siguen en vigor al construir (los caducados los descarta también «Mi mañana»).
		alerts: trim(alerts, (d) => ({ ...d, alerts: d.alerts.filter((a) => Date.parse(a.expires) > Date.now()) })),
		// Las 3 más baratas de gasolina 95 (sin el historial ni el resto de gasolineras).
		fuel: trim(fuel, (d) => ({
			...d,
			history: undefined,
			stations: d.stations
				.filter((s) => s.prices.g95 !== null)
				.sort((a, b) => (a.prices.g95 ?? 0) - (b.prices.g95 ?? 0))
				.slice(0, 3)
		})),
		// Del BOE, el total de cada sección y las 4 primeras disposiciones generales.
		boe: trim(boe, (d) => ({
			...d,
			sections: d.sections.map((s) => ({ ...s, items: s.code === '1' ? s.items.slice(0, 4) : [] }))
		})),
		// Terremotos de las últimas 48 h, los 4 más fuertes.
		quakes: trim(quakes, (d) =>
			d
				.filter((q) => Date.parse(quakes!.fetchedAt) - Date.parse(q.time) < 48 * 3600_000)
				.sort((a, b) => b.mag - a.mag)
				.slice(0, 4)
		),
		hn: trim(hn, (d) => d.slice(0, 5)),
		predictions: trim(predictions, (d) => ({ geopolitics: d.geopolitics.slice(0, 4), economy: [] })),
		// «Lo importante»: los 3 temas de más peso de hoy, ya elegidos (sin el histórico ni la memoria).
		// Los 3 de «Lo importante» y 2 más para «Escuchar», que lee 5 (con su traducción, si la hay).
		important: topImportant(imp?.data, 5).map(({ k, title, url, sources, lang, titleEs }) => ({ k, title, url, sources, lang, titleEs })),
		// «Hoy en la agenda»: resultados y festivos de hoy y mañana (la web se vuelve a construir cada
		// 15 min; mañana cubre la medianoche hasta la siguiente publicación).
		earnings: (finnhub?.data.earnings ?? []).filter((e) => e.date === today || e.date === tomorrow),
		holidays: (holidays?.data.items ?? []).filter((h) => h.date === today || h.date === tomorrow),
		// Solo en la portada modular: el termómetro de riesgo de WS (ya calculado, con la historia entera) y
		// el problema de ajedrez del día (unos cientos de bytes).
		risk: computeRisk({ fred: fred?.data, ecb: ecb?.data, crypto: crypto?.data, predictions: predictions?.data }),
		puzzle: lichess?.data ?? null,
		// «Tu semana en 2 minutos» (los lunes, y en la portada modular): los 3 temas de la semana en IMP y 3
		// mercados con su variación en 7 días. Lo completo está en SEMANA.
		week: (() => {
			const get = seriesMap(ecb, fred);
			const w = weekSummary({
				imp: imp?.data,
				releases: null,
				markets: [
					{ label: 'EUR/USD', series: get('eurusd'), kind: 'pct', decimals: 4 },
					{ label: 'Petróleo WTI ($)', series: get('wti'), kind: 'pct' },
					{ label: 'Bitcoin ($)', kind: 'pct', decimals: 0, series: dailySeries('btc', 'Bitcoin', '$', 'CoinGecko', (crypto?.data.btcHistory ?? []).map((d) => ({ date: d.date, v: d.usd }))) }
				]
			});
			return { top: w.top.slice(0, 3).map(({ k, title, url, days }) => ({ k, title, url, days })), markets: w.markets };
		})()
	};
};
