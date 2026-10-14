import { dataset, type SourceStatus } from '#lib/data.ts';
import { missingNote } from '#lib/missing.ts';
import { trim } from '#lib/trim.ts';
import type { FinnhubData, HolidaysData } from '#lib/types.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [finnhub, holidays, status] = await Promise.all([
		dataset<FinnhubData>('finnhub'),
		dataset<HolidaysData>('holidays'),
		dataset<SourceStatus[]>('status')
	]);
	// De Finnhub, la agenda solo usa los resultados (las noticias y cotizaciones no se pintan aquí).
	// Si no hay datos, solo el motivo (sin clave, error de descarga…), no todo status.json.
	const finnhubMissing = finnhub ? null : missingNote(status?.data, 'finnhub');
	return { finnhub: trim(finnhub, (d) => ({ earnings: d.earnings, news: [], quotes: [] })), finnhubMissing, holidays };
};
