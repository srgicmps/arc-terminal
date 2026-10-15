// Datos de la app Sencilla, ya recortados: lo usan los +page.server.ts de src/routes/app al construir la web. Al
// navegador llegan las tarjetas (facts.ts), las historias y lo justo de luz, gasolina y tiempo, no los JSON enteros.
import type { Story } from '../components/sencillo/Stories.svelte';
import { dataset } from '../data.ts';
import type { FuelData, FuelSpainData } from '../fuel.ts';
import { topImportant } from '../imp.ts';
import { seriesMap, spread } from '../series.ts';
import type { CryptoData, ImpData, NewsData, PowerData, SeriesData, WeatherData } from '../types.ts';
import type { AirData, AlertsData } from '../weather.ts';
import { euriborFact, eurusdFact, inflationFact, mortgageFact, premiumFact, present, unemploymentFact } from './facts.ts';

/** Tu dinero: las cifras que tocan el bolsillo, en tarjetas. */
export async function money() {
	const [ecb, eurostat, crypto] = await Promise.all([dataset<SeriesData>('ecb'), dataset<SeriesData>('eurostat'), dataset<CryptoData>('crypto')]);
	const get = seriesMap(ecb, eurostat);
	const btc = crypto?.data.coins.find((c) => c.id === 'bitcoin');
	return {
		facts: present([
			inflationFact(get('inflation-es')),
			euriborFact(get('euribor-12m')),
			mortgageFact(get('mortgage-es')),
			unemploymentFact(get('unemployment-es')),
			premiumFact(spread(get('bond10-es'), get('bond10-de'), 'premium-es', 'Prima de riesgo')),
			eurusdFact(get('eurusd'))
		]),
		bitcoin: btc ? { eur: btc.eur, change: btc.change24h, spark: (crypto?.data.btcHistory ?? []).slice(-90).map((d) => d.usd) } : null
	};
}

/** Tu casa: luz por horas (hoy y mañana), gasolina por provincia y en Menorca, tiempo de las ciudades, aire y polen. */
export async function home() {
	const [power, fuel, fuelEs, weather, air, alerts] = await Promise.all([
		dataset<PowerData>('power'),
		dataset<FuelData>('fuel'),
		dataset<FuelSpainData>('fuel-es'),
		dataset<WeatherData>('weather'),
		dataset<AirData>('air'),
		dataset<AlertsData>('alerts')
	]);
	return {
		pvpc: power?.data.pvpc ?? [],
		fuelSpain: fuelEs?.data.avg.g95 ?? null,
		fuelProvinces: (fuelEs?.data.provinces ?? []).map((p) => ({ id: p.id, name: p.name, avg: p.avg.g95, min: p.min.g95 })),
		// Las 3 gasolineras más baratas de gasolina 95 de Menorca (fuel.json), sin el historial.
		cheapest: (fuel?.data.stations ?? [])
			.filter((s) => s.prices.g95 !== null)
			.sort((a, b) => (a.prices.g95 ?? 0) - (b.prices.g95 ?? 0))
			.slice(0, 3)
			.map((s) => ({ name: s.name, town: s.town, price: s.prices.g95 as number })),
		weather: (weather?.data.places ?? []).map((p) => ({ name: p.name, current: p.current, daily: p.daily.slice(0, 3) })),
		air: air ? { place: air.data.place, now: air.data.now } : null,
		alerts: (alerts?.data.alerts ?? []).filter((a) => Date.parse(a.expires) > Date.now())
	};
}

const SECTIONS = ['geo', 'eco', 'es', 'tech', 'ai', 'ws'] as const;

/** El mundo: lo más importante de hoy (IMP) y los titulares de cada tema, como historias. */
export async function world(perSection = 4) {
	const [imp, ...news] = await Promise.all([dataset<ImpData>('imp'), ...SECTIONS.map((s) => dataset<NewsData>(`news-${s}`))]);
	const important: Story[] = topImportant(imp?.data, 5).map((e) => ({
		title: e.titleEs ?? e.title,
		url: e.url,
		source: e.sources[0] ?? '',
		count: e.sources.length,
		topic: e.sections?.[0]
	}));
	const sections = SECTIONS.map((s, i) => ({
		key: s,
		stories: (news[i]?.data.items ?? []).slice(0, perSection).map(
			(n): Story => ({ title: n.titleEs ?? n.title, url: n.url, source: n.source, time: n.time, topic: s, count: 1 + (n.also?.length ?? 0) })
		)
	}));
	return { important, sections };
}
