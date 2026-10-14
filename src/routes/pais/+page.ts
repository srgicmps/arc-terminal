import { dataset } from '#lib/data.ts';
import type { Mention } from '#lib/news.ts';
import type { ImfData, SeriesData, YieldCurveData } from '#lib/types.ts';
import type { PageLoad } from './$types';

// Las series de todas las fuentes de macro y mercados; la vista elige las del país. Los titulares van ya
// repartidos por país (scripts/news-index.ts → news-countries.json), para no cargar todas las secciones.
export const load: PageLoad = async () => {
	const [eurostat, ecb, bls, fred, bis, uscurve, imf, news] = await Promise.all([
		dataset<SeriesData>('eurostat'),
		dataset<SeriesData>('ecb'),
		dataset<SeriesData>('bls'),
		dataset<SeriesData>('fred'),
		dataset<SeriesData>('bis'),
		dataset<YieldCurveData>('uscurve'),
		dataset<ImfData>('imf'),
		dataset<Record<string, Mention[]>>('news-countries')
	]);
	const series = [eurostat, ecb, bls, fred, bis].flatMap((d) => d?.data.series ?? []);
	return { series, curve: uscurve?.data ?? null, imf: imf?.data ?? null, news: news?.data ?? {} };
};
