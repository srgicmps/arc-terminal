// Países favoritos (2e.9): los que sigues, guardados en el navegador. Lógica pura, para probarla; el estado
// está en favcountries.svelte.ts.

export const FAV_COUNTRIES_KEY = 'arc-countries';
export const MAX_FAV_COUNTRIES = 8;

/** Añade o quita un país de la lista. Si ya hay el máximo, el nuevo sustituye al más antiguo. */
export function toggleCountry(list: readonly string[], code: string, max = MAX_FAV_COUNTRIES): string[] {
	if (list.includes(code)) return list.filter((c) => c !== code);
	return [...list, code].slice(-max);
}

/** La lista guardada, sin códigos que no existan ni repetidos. */
export function cleanCountries(saved: unknown, valid: (code: string) => boolean, max = MAX_FAV_COUNTRIES): string[] {
	if (!Array.isArray(saved)) return [];
	return [...new Set(saved.filter((c): c is string => typeof c === 'string' && valid(c)))].slice(0, max);
}
