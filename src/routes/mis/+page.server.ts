// MIS: la lista de valores vive en el navegador, así que viaja el índice entero (es pequeño). Es
// +page.server.ts para que el JSON no entre en la build del navegador.
import { dataset } from '#lib/data.ts';
import type { Mention } from '#lib/news.ts';
import type { PageServerLoad } from './$types';

// Titulares que nombran cada valor (scripts/news-index.ts): la vista se queda con los de la lista.
export const load: PageServerLoad = async () => ({ news: await dataset<Record<string, Mention[]>>('news-index') });
