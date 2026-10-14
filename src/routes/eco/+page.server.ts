import { dataset } from '#lib/data.ts';
import { headlines, pickSeries } from '#lib/trim.ts';
import type { ImfData, NewsData, PredictionsData, SeriesData } from '#lib/types.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [eurostat, ecb, bls, usdebt, fred, bis, gie, imf, news, predictions] = await Promise.all([
		dataset<SeriesData>('eurostat'),
		dataset<SeriesData>('ecb'),
		dataset<SeriesData>('bls'),
		dataset<SeriesData>('usdebt'),
		dataset<SeriesData>('fred'),
		dataset<SeriesData>('bis'),
		// Gas almacenado: la tabla compara con hace un año, así que necesita todo el historial.
		dataset<SeriesData>('gie'),
		dataset<ImfData>('imf'),
		dataset<NewsData>('news-eco'),
		dataset<PredictionsData>('predictions')
	]);
	// Del BCE, todo menos los tipos de cambio (están en WS); de los titulares, los 25 que se pintan.
	const fx = (ecb?.data.series ?? []).filter((s) => s.id.startsWith('eur') && !s.id.startsWith('euribor')).map((s) => s.id);
	const rest = (ecb?.data.series ?? []).map((s) => s.id).filter((id) => !fx.includes(id));
	return { eurostat, ecb: pickSeries(ecb, rest), bls, usdebt, fred, bis, gie, imf, news: headlines(news, 25), predictions };
};
