import { dataset } from '#lib/data.ts';
import type { Mention } from '#lib/news.ts';
import type { AnalystsData, SecData } from '#lib/types.ts';
import type { PageServerLoad } from './$types';

// Los documentos de la SEC y los titulares de todos los valores (dos archivos pequeños); la vista
// elige los suyos.
export const load: PageServerLoad = async () => {
	const [sec, news, analysts] = await Promise.all([
		dataset<SecData>('sec'),
		dataset<Record<string, Mention[]>>('news-index'),
		// Analistas, resultados y directivos (Finnhub): solo valores de EE. UU., unos pocos KB cada uno.
		dataset<AnalystsData>('analysts')
	]);
	return { sec, news, analysts };
};
