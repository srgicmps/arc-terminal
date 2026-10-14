// MIS: la lista de valores vive en el navegador, así que viaja el índice entero (es pequeño). Es
// +page.server.ts para que el JSON no entre en la build del navegador.
import { dataset } from '#lib/data.ts';
import { madridDate } from '#lib/meetings.ts';
import type { Mention } from '#lib/news.ts';
import { trim } from '#lib/trim.ts';
import type { FinnhubData } from '#lib/types.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [news, finnhub] = await Promise.all([
		// Titulares que nombran cada valor (scripts/news-index.ts): la vista se queda con los de la lista.
		dataset<Record<string, Mention[]>>('news-index'),
		dataset<FinnhubData>('finnhub')
	]);
	// De Finnhub solo hacen falta los resultados de las próximas 2 semanas (con un día de margen por si la
	// web se construyó ayer): ni noticias ni cotizaciones.
	const now = Date.now();
	const from = madridDate(now - 86_400_000);
	const to = madridDate(now + 15 * 86_400_000);
	return {
		news,
		finnhub: trim(finnhub, (d) => ({
			earnings: d.earnings.filter((e) => e.date >= from && e.date <= to),
			news: [],
			quotes: []
		}))
	};
};
