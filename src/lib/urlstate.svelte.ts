// Un $state enlazado con un parámetro de la URL (como un composable de Vue con useRoute y router.replace).
// Sigue a la URL (si cambia el parámetro, o desaparece, cambia el valor); al cambiar el valor lo escribe
// con una navegación «shallow», sin recargar ni llenar el historial. Hay que llamarlo al crear el
// componente (usa $effect).
//
// Uso:  const period = urlState('periodo', 'day', (v) => IMP_PERIODS.some((p) => p.key === v));
//       period.value = 'month';  →  /imp?periodo=month
import { goto } from '$app/navigation';
import { page } from '$app/state';
import { withParam } from './urlstate.ts';

export { withParam };

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

export function urlState<T extends string>(name: string, fallback: T, isValid: (v: string) => boolean) {
	let value = $state<T>(fallback);
	// En el navegador (al prerenderizar no hay URL con parámetros), cada vez que cambia la URL: su valor si
	// vale; si falta o no vale, el de por defecto. Un valor que no vale (?periodo=xx) se quita de la URL.
	$effect(() => {
		const fromUrl = page.url.searchParams.get(name);
		const ok = fromUrl !== null && isValid(fromUrl);
		value = ok ? (fromUrl as T) : fallback;
		if (fromUrl !== null && !ok) writeParams({ [name]: null });
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
