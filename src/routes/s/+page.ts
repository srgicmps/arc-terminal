import { dataset } from '#lib/data.ts';
import type { Mention } from '#lib/news.ts';
import type { SecData } from '#lib/types.ts';
import type { PageLoad } from './$types';

// Los documentos de la SEC y los titulares de todos los valores (dos archivos pequeños); la vista
// elige los suyos.
export const load: PageLoad = async () => {
	const [sec, news] = await Promise.all([dataset<SecData>('sec'), dataset<Record<string, Mention[]>>('news-index')]);
	return { sec, news };
};
