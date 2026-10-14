// Filtros de los titulares (M23): medios silenciados y el idioma original que se quiere ver. Funciones
// puras para probarlas; el estado guardado en el navegador está en newsprefs.svelte.ts.
import type { NewsItem } from './types.ts';

/** Idioma original de los medios: los dos, solo los que publican en español o solo los de inglés. */
export type NewsOrigin = 'all' | 'es' | 'en';

/** Los titulares que se enseñan: sin los medios silenciados y del idioma elegido. */
export function visibleNews<T extends NewsItem>(items: T[], muted: readonly string[], origin: NewsOrigin): T[] {
	if (!muted.length && origin === 'all') return items;
	const off = new Set(muted);
	return items.filter((i) => !off.has(i.source) && (origin === 'all' || (origin === 'en') === (i.lang === 'en')));
}
