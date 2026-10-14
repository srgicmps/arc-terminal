// «Encajar en pantalla» (solo escritorio): la vista ocupa la altura de la ventana y cada panel hace
// scroll por dentro, sin scroll de página. Se guarda en este navegador y va en <html data-fit>; el CSS
// de +layout.svelte solo lo aplica a partir de 1280 px, así que en el móvil no cambia nada.

const KEY = 'arc-fit';

export const fit = $state({ on: false });

function apply() {
	if (fit.on) document.documentElement.dataset.fit = '';
	else delete document.documentElement.dataset.fit;
}

/** Se llama al arrancar en el navegador (desde el layout). */
export function initFit() {
	try {
		fit.on = localStorage.getItem(KEY) === '1';
	} catch {}
	apply();
}

export function toggleFit() {
	fit.on = !fit.on;
	try {
		localStorage.setItem(KEY, fit.on ? '1' : '0');
	} catch {}
	apply();
}

/** Pantalla completa del navegador (Fullscreen API), para usar Arc Terminal como un monitor. */
export function toggleFullscreen() {
	if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
	else document.documentElement.requestFullscreen?.().catch(() => {});
}
