import { dataset, type SourceStatus } from '#lib/data.ts';
import { missingNote } from '#lib/missing.ts';
import { headlines, pickSeries } from '#lib/trim.ts';
import type { ImfData, NewsData, PredictionsData, SeriesData } from '#lib/types.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [eurostat, ecb, bls, usdebt, fred, bis, imf, news, predictions, status] = await Promise.all([
		dataset<SeriesData>('eurostat'),
		dataset<SeriesData>('ecb'),
		dataset<SeriesData>('bls'),
		dataset<SeriesData>('usdebt'),
		dataset<SeriesData>('fred'),
		dataset<SeriesData>('bis'),
		dataset<ImfData>('imf'),
		dataset<NewsData>('news-eco'),
		dataset<PredictionsData>('predictions'),
		dataset<SourceStatus[]>('status')
	]);
	// Del BCE, todo menos los tipos de cambio (están en WS); de los titulares, los 25 que se pintan.
	const fx = (ecb?.data.series ?? []).filter((s) => s.id.startsWith('eur') && !s.id.startsWith('euribor')).map((s) => s.id);
	const rest = (ecb?.data.series ?? []).map((s) => s.id).filter((id) => !fx.includes(id));
	// Si no hay datos de FRED, solo el motivo (sin clave, error de descarga…), no todo status.json.
	const fredMissing = fred ? null : missingNote(status?.data, 'fred');
	return { eurostat, ecb: pickSeries(ecb, rest), bls, usdebt, fred, fredMissing, bis, imf, news: headlines(news, 25), predictions };
};
