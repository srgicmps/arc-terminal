// Fundido entre vistas con la View Transitions API: lógica pura, para probarla con Vitest. El layout la llama en
// onNavigate (un gancho de SvelteKit parecido a router.beforeResolve de Vue Router, pero que llega cuando la vista
// nueva ya tiene sus datos). Solo funde la página entera al cambiar de vista: nada dentro de una vista (filtros,
// ?lugar=, #panel) ni morph de paneles. Dura --dur-view, que vale 0 (sin fundido) salvo en las estéticas que lo
// piden (de momento, Grafito); Terminal, Brutal y Contraste siguen siendo instantáneas.

/** Lo que mira de una navegación (el `Navigation` de SvelteKit encaja). */
export interface NavLike {
	type: string;
	willUnload: boolean;
	from: { url: URL } | null;
	to: { url: URL } | null;
}

/** Lo que mira del navegador y de la página. */
export interface ViewEnv {
	/** Existe document.startViewTransition (Chrome, Edge, Safari 18+; Firefox aún no). */
	supported: boolean;
	/** El sistema pide menos movimiento. */
	reduced: boolean;
	/** Modo TV (html[data-tv]): rota solo, sin adornos. */
	tv: boolean;
	/** Vista dentro de una ventana de Arc OS (html[data-embed]). */
	embedded: boolean;
	/** Arc OS a pantalla entera (html[data-os-look]). */
	os: boolean;
	/** --dur-view en milisegundos. Se lee al final: en el layout es un getter y así solo cuesta si hace falta. */
	readonly ms: number;
}

const isOs = (path: string) => /^\/os\/?$/.test(path);

/** ¿Hay que fundir esta navegación? */
export function wants(nav: NavLike, env: ViewEnv): boolean {
	if (!env.supported || env.reduced || env.tv || env.embedded || env.os) return false;
	// Atrás y adelante: en iOS y Android el gesto ya trae su animación y se vería doble.
	if (nav.type === 'popstate' || nav.willUnload || !nav.from || !nav.to) return false;
	const a = nav.from.url;
	const b = nav.to.url;
	// Solo cuando cambia la vista: si solo cambian ?query o #panel, es la misma.
	if (a.origin !== b.origin || a.pathname === b.pathname || isOs(a.pathname) || isOs(b.pathname)) return false;
	return env.ms > 0;
}

/** Un tiempo de CSS («140ms», «0.14s», «0ms») en milisegundos. Lo que no se entiende cuenta como 0: sin fundido. */
export function durationMs(value: string): number {
	const m = /^\s*([\d.]+)(ms|s)\s*$/i.exec(value);
	const n = m ? parseFloat(m[1]) * (m[2].toLowerCase() === 's' ? 1000 : 1) : 0;
	return Number.isFinite(n) ? n : 0;
}

/** El entorno de verdad, para `wants`. La duración se lee de --dur-view solo si llega a hacer falta. */
export function viewEnv(): ViewEnv {
	const html = document.documentElement;
	return {
		supported: typeof document.startViewTransition === 'function',
		reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
		tv: 'tv' in html.dataset,
		embedded: html.dataset.embed === '1',
		os: 'osLook' in html.dataset,
		get ms() {
			return durationMs(getComputedStyle(html).getPropertyValue('--dur-view'));
		}
	};
}

/**
 * Funde la vista vieja con la nueva: la receta de la documentación de SvelteKit. La promesa se resuelve cuando el
 * navegador ya tiene la foto de la vista vieja, y SvelteKit pinta entonces la nueva. Los catch hacen falta: si se
 * navega otra vez antes de acabar, el navegador cancela el fundido y sus promesas fallan (AbortError); sin capturarlas
 * saldrían como errores en la consola.
 */
export function fade(complete: Promise<unknown>, doc: Pick<Document, 'startViewTransition'> = document): Promise<void> {
	return new Promise((resolve) => {
		try {
			const t = doc.startViewTransition(async () => {
				resolve();
				await complete;
			});
			t.ready.catch(() => {});
			t.finished.catch(() => {});
			t.updateCallbackDone.catch(() => {});
		} catch {
			// Si el navegador no puede, se navega sin fundido.
			resolve();
		}
	});
}
