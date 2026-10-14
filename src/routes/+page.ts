import { dataset } from '#lib/data.ts';
import type { PageLoad } from './$types';

const SECTIONS = ['es', 'eco', 'geo', 'ws', 'tech', 'ai'] as const;

export const load: PageLoad = async () => {
	const [news, ecb, eurostat, bls, crypto, power, weather, fuel, boe, quakes, hn, predictions] = await Promise.all([
		Promise.all(SECTIONS.map((s) => dataset(`news-${s}`))),
		dataset('ecb'),
		dataset('eurostat'),
		dataset('bls'),
		dataset('crypto'),
		dataset('power'),
		dataset('weather'),
		dataset('fuel'),
		dataset('boe'),
		dataset('quakes'),
		dataset('hn'),
		dataset('predictions')
	]);

	// Titulares de portada: los 3 más recientes de cada sección, mezclados por hora.
	const headlines = SECTIONS.flatMap((section, i) =>
		(news[i]?.data.items ?? []).slice(0, 3).map((item) => ({ ...item, section: section.toUpperCase() }))
	).sort((a, b) => (b.time ?? '').localeCompare(a.time ?? ''));

	return { headlines, ecb, eurostat, bls, crypto, power, weather, fuel, boe, quakes, hn, predictions };
};
