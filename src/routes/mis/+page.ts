import { dataset } from '#lib/data.ts';
import type { Mention } from '#lib/news.ts';
import type { FinnhubData } from '#lib/types.ts';
import type { PageLoad } from './$types';

// Titulares que nombran cada valor (scripts/news-index.ts): la vista se queda con los de la lista.
// Y los resultados de Finnhub, para «Tus próximos resultados».
export const load: PageLoad = async () => {
	const [news, finnhub] = await Promise.all([
		dataset<Record<string, Mention[]>>('news-index'),
		dataset<FinnhubData>('finnhub')
	]);
	return { news, finnhub };
};
