import { dataset } from '#lib/data.ts';
import type { FuelData } from '#lib/fuel.ts';
import type {
	BoeData,
	CryptoData,
	HnItem,
	NewsData,
	PowerData,
	Quake,
	SeriesData,
	WeatherData
} from '#lib/types.ts';
import type { PageLoad } from './$types';

const SECTIONS = ['es', 'eco', 'geo', 'ws', 'tech', 'ai'] as const;

export const load: PageLoad = async () => {
	const [news, ecb, eurostat, bls, crypto, power, weather, fuel, boe, quakes, hn] = await Promise.all([
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
		dataset<HnItem[]>('hn')
	]);

	// Titulares de portada: los 3 más recientes de cada sección, mezclados por hora.
	const headlines = SECTIONS.flatMap((section, i) =>
		(news[i]?.data.items ?? []).slice(0, 3).map((item) => ({ ...item, section: section.toUpperCase() }))
	).sort((a, b) => (b.time ?? '').localeCompare(a.time ?? ''));

	return { headlines, ecb, eurostat, bls, crypto, power, weather, fuel, boe, quakes, hn };
};
