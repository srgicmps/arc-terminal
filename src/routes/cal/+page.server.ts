import { dataset, type SourceStatus } from '#lib/data.ts';
import { missingNote } from '#lib/missing.ts';
import { trim } from '#lib/trim.ts';
import type { FinnhubData, HolidaysData, ReleaseCalData } from '#lib/types.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [finnhub, holidays, status, releases] = await Promise.all([
		dataset<FinnhubData>('finnhub'),
		dataset<HolidaysData>('holidays'),
		dataset<SourceStatus[]>('status'),
		dataset<ReleaseCalData>('releases-cal')
	]);
	// De Finnhub, la agenda solo usa los resultados (las noticias y cotizaciones no se pintan aquí).
	// Si no hay datos, solo el motivo (sin clave, error de descarga…), no todo status.json.
	const finnhubMissing = finnhub ? null : missingNote(status?.data, 'finnhub');
	return {
		finnhub: trim(finnhub, (d) => ({ earnings: d.earnings, news: [], quotes: [] })),
		finnhubMissing,
		holidays,
		releases
	};
};
