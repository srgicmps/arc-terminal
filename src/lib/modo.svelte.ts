// Estado del modo en el navegador (reglas en modo.ts). `modo.all` enseña todos los paneles de la vista en curso
// aunque estemos en Sencillo; `hiddenPanels` son los títulos que el modo ha ocultado en ella (para «Ver todos»).
import { SvelteSet } from 'svelte/reactivity';
import { isModo, MODO_KEY, MODOS, type Modo } from './modo.ts';

export { MODOS, type Modo };

const initial = (): Modo => {
	if (typeof document === 'undefined') return 'terminal';
	const m = document.documentElement.dataset.modo;
	return isModo(m) ? m : 'terminal';
};

export const modo = $state({ value: initial(), all: false });
export const hiddenPanels = new SvelteSet<string>();

export const isSimple = () => modo.value === 'sencillo';
/** ¿Se ocultan ahora los paneles que no son esenciales? En Sencillo, salvo con «Ver todos». */
export const trimming = () => isSimple() && !modo.all;

/**
 * «Ver todos» (true) o «Ver solo lo esencial» (false). Va también a <html data-all>: la regla CSS de Panel que
 * oculta los paneles no esenciales antes de que arranque Svelte lo mira, y tiene que decir lo mismo que `trimming()`.
 */
export function setAll(value: boolean) {
	modo.all = value;
	document.documentElement.toggleAttribute('data-all', value);
}

export function setModo(value: Modo) {
	modo.value = value;
	setAll(false);
	document.documentElement.dataset.modo = value;
	try {
		localStorage.setItem(MODO_KEY, value);
	} catch {}
}
