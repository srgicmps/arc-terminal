// Países favoritos en este navegador (como un store de Pinia con persistencia). Se marcan en PAIS.
import { COUNTRIES } from './countries.ts';
import { cleanCountries, FAV_COUNTRIES_KEY, toggleCountry } from './favcountries.ts';

export const favCountries = $state({ codes: [] as string[], ready: false });

const exists = (code: string) => COUNTRIES.some((c) => c.code === code);

/** Lee lo guardado. Solo en el navegador (desde un $effect); la segunda vez no hace nada. */
export function initFavCountries() {
	if (favCountries.ready) return;
	try {
		favCountries.codes = cleanCountries(JSON.parse(localStorage.getItem(FAV_COUNTRIES_KEY) ?? '[]'), exists);
	} catch {}
	favCountries.ready = true;
}

export function toggleFavCountry(code: string) {
	favCountries.codes = toggleCountry(favCountries.codes, code);
	try {
		localStorage.setItem(FAV_COUNTRIES_KEY, JSON.stringify(favCountries.codes));
	} catch {}
}
