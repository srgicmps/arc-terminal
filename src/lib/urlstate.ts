// Estado de la vista en la URL (parte sin Svelte, con tests): un parámetro por cada selector, para que
// un enlace o un favorito abra exactamente lo mismo. El valor por defecto no se escribe: /fuel en vez de
// /fuel?combustible=g95.

/** La misma URL con `name` puesto a `value`, o sin él si `value` es el valor por defecto (o null). */
export function withParam(url: URL, name: string, value: string | null, fallback?: string): URL {
	const next = new URL(url);
	if (value === null || value === fallback) next.searchParams.delete(name);
	else next.searchParams.set(name, value);
	return next;
}

/**
 * Cuenta las navegaciones de verdad a partir de cada page.url (lo usa navKey, en urlstate.svelte.ts). SvelteKit
 * cambia page.url por otro objeto en cada navegación, también a la misma dirección («ECO TIPOS» otra vez), y en
 * cada refresco de datos (refreshAll, src/lib/fresh.ts), que deja la misma dirección y no navega. Así, un $effect
 * que lea el contador se repite con cada navegación, como antes, pero no con los datos nuevos.
 * `navigating`: si SvelteKit está navegando (navigating.type). Un enlace a otro #hash cambia la dirección sin él.
 */
export function navCounter() {
	let count = 0;
	let last: { readonly href: string } | undefined;
	return (url: { readonly href: string }, navigating: boolean): number => {
		if (url !== last) {
			if (!last || url.href !== last.href || navigating) count++;
			last = url;
		}
		return count;
	};
}
