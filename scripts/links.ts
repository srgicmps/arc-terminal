// Filtro de enlaces al guardar los datos: un «javascript:» que llegue de una API (un RSS, un .ics, un feed de
// avisos) acabaría en un href de la web y, al pulsarlo, correría con la sesión de quien lo abre. Svelte no
// filtra los href, así que se limpia aquí, en un solo sitio, antes de escribir static/data.
//
// Se filtra por nombre de clave, no por el texto: un titular puede empezar por «JavaScript: …» o «Data: …».

/** Claves que guardan enlaces en los datos (`u`, el del índice de búsqueda; `arxiv`, `pdf`, `html`, de los papers). */
export const LINK_KEYS: ReadonlySet<string> = new Set(['url', 'link', 'href', 'u', 'pdf', 'html', 'arxiv', 'page']);

/**
 * Enlaces que se dejan pasar: absolutos http(s) y rutas de la propia web («/s?sym=NVDA»). No vale «//otra.web»
 * (sin esquema, va a otro sitio) ni «/\otra.web», que el navegador lee igual. Antes se quitan los espacios
 * de los lados, que el navegador también ignora.
 */
const SAFE = /^(https?:\/\/|\/(?![/\\]))/i;

/** ¿Se puede poner este texto en un href? Vacío también vale: no enlaza a nada. */
export const isSafeLink = (value: string) => value === '' || SAFE.test(value.trim());

/**
 * Recorre los datos (listas y objetos, a cualquier profundidad) y deja en '' los textos de LINK_KEYS que no
 * son enlaces http(s) ni rutas de la web. Cambia `value` en el sitio y devuelve cuántos ha vaciado.
 */
export function cleanLinks(value: unknown): number {
	if (Array.isArray(value)) return value.reduce((n: number, item) => n + cleanLinks(item), 0);
	if (!value || typeof value !== 'object') return 0;
	let emptied = 0;
	const record = value as Record<string, unknown>;
	for (const [key, item] of Object.entries(record)) {
		if (typeof item === 'string') {
			if (LINK_KEYS.has(key) && !isSafeLink(item)) {
				record[key] = '';
				emptied++;
			}
		} else if (item && typeof item === 'object') emptied += cleanLinks(item);
	}
	return emptied;
}

/** El aviso para el registro de la Action si se ha vaciado algún enlace (`where`: la fuente o el archivo), o null. */
export function linksWarning(where: string, emptied: number): string | null {
	if (!emptied) return null;
	return `::warning::${where}: ${emptied} ${emptied === 1 ? 'enlace no http(s) vaciado' : 'enlaces no http(s) vaciados'}`;
}
