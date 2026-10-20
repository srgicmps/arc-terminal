// Datos nuevos sin recargar (F04): el estado de los avisos y el bucle, conectado con SvelteKit. La lógica, en
// fresh.ts. Lo arranca +layout.svelte con $effect(startFresh) (como un onMounted de Vue que devuelve su limpieza).
// Ojo al refrescar: SvelteKit cambia page.url y page.route por objetos nuevos (con lo mismo dentro). Un $effect que
// lea page.url se vuelve a ejecutar; por eso los que mueven algo leen un $derived con el texto y, para repetirse
// con cada navegación (el mismo comando otra vez), navKey (urlstate.svelte.ts), que no cambia al refrescar.
import { tick } from 'svelte';
import { dev, version } from '$app/env';
import { refreshAll } from '$app/navigation';
import { resolve } from '$app/paths';
import { page } from '$app/state';
import type { FreshState } from './fresh.ts';
import { tv } from './tv.svelte.ts';

/** Lo que enseña el layout: «Hay datos nuevos · Actualizar» (aviso) o «Hay una versión nueva · Recargar» (codigo). */
export const fresh: FreshState = $state({ aviso: false, codigo: false });

let apply: (() => Promise<void>) | null = null;

export function startFresh() {
	// En `pnpm dev` no hay publicaciones (SvelteKit tampoco sondea).
	if (dev) return;
	let stop: (() => void) | undefined;
	let gone = false;
	// La lógica (~1 KB) llega en un archivo aparte con import(): no pesa en la primera carga de ninguna vista, y
	// no hace falta hasta la primera pregunta (a los 5 s). Si no llega (sin red), no hay aviso y ya está.
	import('./fresh.ts')
		.then((m) => {
			if (gone) return;
			const w = m.watch(fresh, {
				// Su commit lo aprende de /code.json (fresh.ts): así el código del navegador no cambia con cada commit.
				mine: { v: version },
				read: () => m.readBuild(fetch, resolve('/code.json')),
				// refreshAll vuelve a pedir el __data.json de la vista (el service worker lo trae de la red primero) y,
				// a diferencia de invalidateAll, conserva page.state. Si acaba en la página de error, falla (loadOrFail).
				refresh: () =>
					m.keepPlace(window, () =>
						m.loadOrFail(
							async () => {
								await refreshAll();
								await tick();
							},
							() => !!page.error
						)
					),
				auto: () => tv.on || page.route.id === '/',
				tv: () => tv.on,
				typing: () => m.holdsFocus(document.activeElement),
				doc: document,
				win: window
			});
			apply = w.apply;
			stop = w.stop;
		})
		.catch(() => {});
	return () => {
		gone = true;
		stop?.();
		apply = null;
	};
}

/**
 * El botón «Actualizar»: refresca ya, en su sitio. El botón desaparece al terminar; si tenía el foco (con el
 * teclado), pasa a la vista (#contenido), no al principio de la página.
 */
export async function refreshNow() {
	const from = document.activeElement;
	await apply?.();
	await tick();
	if (from && from !== document.body && !from.isConnected) document.getElementById('contenido')?.focus({ preventScroll: true });
}
