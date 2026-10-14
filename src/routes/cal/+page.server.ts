import { dataset } from '#lib/data.ts';
import { trim } from '#lib/trim.ts';
import type { FinnhubData, HolidaysData } from '#lib/types.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [finnhub, holidays] = await Promise.all([dataset<FinnhubData>('finnhub'), dataset<HolidaysData>('holidays')]);
	// De Finnhub, la agenda solo usa los resultados (las noticias y cotizaciones no se pintan aquí).
	return { finnhub: trim(finnhub, (d) => ({ earnings: d.earnings, news: [], quotes: [] })), holidays };
};
