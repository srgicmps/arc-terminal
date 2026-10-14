// Un $state enlazado con un parámetro de la URL (como un composable de Vue con useRoute y router.replace).
// Al abrir la vista lee el parámetro; al cambiar el valor lo escribe con replaceState, sin recargar ni
// llenar el historial. Hay que llamarlo al crear el componente (usa $effect).
//
// Uso:  const map = urlState('mapa', 'spx', (v) => MAPS.some((m) => m.key === v));
//       map.value = 'dax';  →  /ws?mapa=dax
import { replaceState } from '$app/navigation';
import { page } from '$app/state';
import { withParam } from './urlstate.ts';

export { withParam };

/** Escribe uno o varios parámetros en la URL actual sin navegar. Solo en el navegador. */
export function writeParams(values: Record<string, string | null>, fallbacks: Record<string, string> = {}) {
	if (typeof location === 'undefined') return;
	let url = new URL(location.href);
	for (const [name, value] of Object.entries(values)) url = withParam(url, name, value, fallbacks[name]);
	if (url.href === location.href) return;
	try {
		replaceState(url, page.state);
	} catch {
		// Antes de que arranque el router de SvelteKit (justo al abrir la vista) no se puede: se espera un momento.
		setTimeout(() => replaceState(url, page.state), 0);
	}
}

export function urlState<T extends string>(name: string, fallback: T, isValid: (v: string) => boolean) {
	let value = $state<T>(fallback);
	// Al arrancar en el navegador (al prerenderizar no hay URL con parámetros): el valor de la URL, si vale.
	$effect(() => {
		const fromUrl = new URLSearchParams(location.search).get(name);
		if (fromUrl !== null && isValid(fromUrl)) value = fromUrl as T;
	});
	return {
		get value() {
			return value;
		},
		set value(next: T) {
			value = next;
			writeParams({ [name]: next }, { [name]: fallback });
		}
	};
}
