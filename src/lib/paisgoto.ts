// Fila «Ir a» de PAIS (2e.13): desde la ficha de un país, a lo demás que habla de él. Lógica pura, para
// probarla; las rutas las resuelve la vista.
import type { Country } from './countries.ts';

export interface GoTo {
	code: string;
	/** Ruta de la vista, sin base: «/news». */
	route: '/news' | '/eco' | '/es' | '/geo' | '/cal' | '/pais';
	/** Parámetros de la URL, ya codificados: «q=Jap%C3%B3n». */
	query?: string;
	/** Para el title del enlace. */
	what: string;
}

/** Los saltos de la ficha de un país y, detrás, el resto de tus países favoritos. */
export function goTo(country: Country, favorites: readonly Country[] = []): GoTo[] {
	const q = (s: string) => `q=${encodeURIComponent(s)}`;
	return [
		{ code: 'NEWS', route: '/news', query: q(country.name), what: `Titulares sobre ${country.name}` },
		...(country.code === 'ES' ? [{ code: 'ES', route: '/es', what: 'España en cifras' } as const] : []),
		...(country.euro ? [{ code: 'ECO', route: '/eco', what: 'Zona euro y BCE' } as const] : []),
		{ code: 'GEO', route: '/geo', what: 'Mapa, terremotos y alertas' },
		{ code: 'CAL', route: '/cal', what: 'Agenda económica' },
		...favorites
			.filter((f) => f.code !== country.code)
			.map((f) => ({ code: f.code, route: '/pais' as const, query: `c=${f.code}`, what: `Ficha de ${f.name}` }))
	];
}
