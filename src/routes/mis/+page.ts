import { dataset } from '#lib/data.ts';
import type { Mention } from '#lib/news.ts';
import type { PageLoad } from './$types';

// Titulares que nombran cada valor (scripts/news-index.ts): la vista se queda con los de la lista.
export const load: PageLoad = async () => ({ news: await dataset<Record<string, Mention[]>>('news-index') });
