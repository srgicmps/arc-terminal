import { dataset } from '#lib/data.ts';
import { headlines, pickSeries } from '#lib/trim.ts';
import type { ImfData, NewsData, PredictionsData, SeriesData, ReleaseCalData } from '#lib/types.ts';
import { nextMap } from '#lib/nextrelease.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [eurostat, ecb, bls, usdebt, fred, bis, imf, news, predictions, cal] = await Promise.all([
		dataset<SeriesData>('eurostat'),
		dataset<SeriesData>('ecb'),
		dataset<SeriesData>('bls'),
		dataset<SeriesData>('usdebt'),
		dataset<SeriesData>('fred'),
		dataset<SeriesData>('bis'),
		dataset<ImfData>('imf'),
		dataset<NewsData>('news-eco'),
		dataset<PredictionsData>('predictions'),
		dataset<ReleaseCalData>('releases-cal')
	]);
	// Del BCE, todo menos los tipos de cambio (están en WS); de los titulares, los 25 que se pintan.
	const fx = (ecb?.data.series ?? [])
		.filter((s) => s.id.startsWith('eur') && !s.id.startsWith('euribor'))
		.map((s) => s.id);
	const rest = (ecb?.data.series ?? []).map((s) => s.id).filter((id) => !fx.includes(id));
	return {
		eurostat,
		ecb: pickSeries(ecb, rest),
		bls,
		usdebt,
		fred,
		bis,
		imf,
		news: headlines(news, 25),
		predictions,
		// Próximo dato de cada serie, calculado aquí: al navegador solo le llega la fecha y el título.
		next: nextMap(
			[eurostat, bls, fred, usdebt, bis].flatMap((d) => d?.data.series.map((s) => s.id) ?? []),
			cal?.data.events ?? []
		)
	};
};
