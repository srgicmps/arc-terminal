// Datos nuevos sin recargar (F04): el estado de los avisos y el bucle, conectado con SvelteKit. La lógica, en
// fresh.ts. Lo arranca +layout.svelte con $effect(startFresh) (como un onMounted de Vue que devuelve su limpieza).
import { tick } from 'svelte';
import { dev, version } from '$app/env';
import { invalidateAll } from '$app/navigation';
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
				// invalidateAll vuelve a pedir el __data.json de la vista (el service worker lo trae de la red primero).
				refresh: () =>
					m.keepPlace(window, async () => {
						await invalidateAll();
						await tick();
					}),
				auto: () => tv.on || page.route.id === '/',
				typing: () => m.isField(document.activeElement),
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

/** El botón «Actualizar»: refresca ya, en su sitio. */
export const refreshNow = () => void apply?.();
