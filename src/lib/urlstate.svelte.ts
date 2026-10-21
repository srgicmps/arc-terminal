// Un $state enlazado con un parámetro de la URL (como un composable de Vue con useRoute y router.replace).
// Sigue a la URL (si cambia el parámetro, o desaparece, cambia el valor); al cambiar el valor lo escribe
// con una navegación «shallow», sin recargar ni llenar el historial. Hay que llamarlo al crear el
// componente (usa $effect).
//
// Uso:  const period = urlState('periodo', 'day', (v) => IMP_PERIODS.some((p) => p.key === v));
//       period.value = 'month';  →  /imp?periodo=month
import { untrack } from 'svelte';
import { goto } from '$app/navigation';
import { navigating, page } from '$app/state';
import { readSaved, save } from './persisted.svelte.ts';
import { navCounter, withParam } from './urlstate.ts';

export { withParam };

/**
 * La URL que se ve en la barra del navegador. Tras escribir con writeParams (navegación «shallow»), SvelteKit deja
 * la nueva en page.shallow.url, y page.url sigue con la de la última navegación de verdad.
 * Para leer un parámetro en un $effect, mejor un $derived con el texto: con cada refresco de datos (fresh.ts)
 * page.url pasa a ser otro objeto igual, y un $effect que lo lea directamente se volvería a ejecutar.
 */
export const shownUrl = () => page.shallow?.url ?? page.url;

const countNav = navCounter();
const navs = $derived(countNav(page.url, untrack(() => navigating.type) !== null));

/**
 * Cambia con cada navegación de verdad, también a la misma URL, y no con un refresco de datos ni con un salto a
 * otro #hash de la misma página (urlstate.ts, navCounter). Un $effect que aplica un parámetro o el hash lo lee junto al texto ($derived): así, repetir el
 * comando de la barra («ECO TIPOS», «BOE vivienda») lo vuelve a aplicar, como antes de refrescar en su sitio.
 */
export const navKey = () => navs;

/** Escribe uno o varios parámetros en la URL actual sin navegar. Solo en el navegador. */
export function writeParams(values: Record<string, string | null>, fallbacks: Record<string, string> = {}) {
	if (typeof location === 'undefined') return;
	let url = new URL(location.href);
	for (const [name, value] of Object.entries(values)) url = withParam(url, name, value, fallbacks[name]);
	if (url.href === location.href) return;
	const write = () => goto(url, { state: page.state, shallow: true, replace: true });
	// Antes de que arranque el router de SvelteKit (justo al abrir la vista) falla: se reintenta una vez.
	write().catch(() => setTimeout(() => write().catch(() => {}), 0));
}

/**
 * Con `remember` (una clave de prefs.ts), además se recuerda en el navegador: si la URL no trae el parámetro,
 * vale lo guardado; la URL manda (un enlace compartido abre lo que dice).
 */
export function urlState<T extends string>(name: string, fallback: T, isValid: (v: string) => boolean, remember?: string) {
	let value = $state<T>(fallback);
	// El parámetro como texto: un refresco de datos (que cambia page.url por otro objeto igual) no lo cambia.
	const fromUrl = $derived(shownUrl().searchParams.get(name));
	// En el navegador (al prerenderizar no hay URL con parámetros), cada vez que cambia el parámetro: su valor si
	// vale; si falta o no vale, el de por defecto. Un valor que no vale (?periodo=xx) se quita de la URL.
	$effect(() => {
		const ok = fromUrl !== null && isValid(fromUrl);
		value = ok ? (fromUrl as T) : ((remember && readSaved<T>(remember, isValid)) || fallback);
		if (fromUrl !== null && !ok) writeParams({ [name]: null });
	});
	return {
		get value() {
			return value;
		},
		set value(next: T) {
			value = next;
			if (remember) save(remember, next);
			writeParams({ [name]: next }, { [name]: fallback });
		}
	};
}
