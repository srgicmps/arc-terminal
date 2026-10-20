// Tema claro / oscuro. Tres modos: «auto» (sigue al sistema), «light» (día) y «dark» (noche).
// El modo se guarda en este navegador. En <html data-theme> va siempre el tema que se ve («light» o
// «dark», también en auto), así app.css solo necesita un bloque por tema. El script en línea de
// src/app.html lo pone antes de pintar la página, para que no parpadee; aquí se mantiene al día.
import { token } from './color.ts';

export type ThemeMode = 'auto' | 'light' | 'dark';

const KEY = 'arc-theme';

export const theme = $state({
	mode: 'auto' as ThemeMode,
	/** El tema que se ve de verdad (en «auto», el del sistema). Arranca con lo que puso app.html. */
	resolved: (typeof document !== 'undefined' && document.documentElement.dataset.theme === 'light'
		? 'light'
		: 'dark') as 'light' | 'dark'
});

function systemLight() {
	return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: light)').matches;
}

function apply() {
	theme.resolved = theme.mode === 'auto' ? (systemLight() ? 'light' : 'dark') : theme.mode;
	document.documentElement.dataset.theme = theme.resolved;
	syncThemeColor();
}

/** Color de la barra del navegador en el móvil (meta theme-color): el fondo que se ve, token --bg del tema y de la
 *  estética. Lo llaman apply() y setStyle (src/lib/taste.svelte.ts), este cuando ha cargado la hoja nueva. */
export function syncThemeColor() {
	document.querySelector('meta[name="theme-color"]')?.setAttribute('content', token('--bg'));
}

/** Se llama al arrancar en el navegador (desde el layout). Devuelve la limpieza del listener. */
export function initTheme() {
	try {
		const saved = localStorage.getItem(KEY);
		if (saved === 'light' || saved === 'dark' || saved === 'auto') theme.mode = saved;
	} catch {}
	apply();
	const media = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: light)') : null;
	const onChange = () => theme.mode === 'auto' && apply();
	media?.addEventListener('change', onChange);
	// Al imprimir (informe de TOP o IMP), siempre el tema de día: papel blanco. Al acabar, el que había.
	const paper = () => (document.documentElement.dataset.theme = 'light');
	const back = () => (document.documentElement.dataset.theme = theme.resolved);
	addEventListener('beforeprint', paper);
	addEventListener('afterprint', back);
	return () => {
		media?.removeEventListener('change', onChange);
		removeEventListener('beforeprint', paper);
		removeEventListener('afterprint', back);
	};
}

/** Elegir el tema directamente (Apariencia). */
export function setTheme(mode: ThemeMode) {
	theme.mode = mode;
	try {
		localStorage.setItem(KEY, theme.mode);
	} catch {}
	apply();
}

/** Auto → Día → Noche → Auto. */
export function cycleTheme() {
	setTheme(theme.mode === 'auto' ? 'light' : theme.mode === 'light' ? 'dark' : 'auto');
}
