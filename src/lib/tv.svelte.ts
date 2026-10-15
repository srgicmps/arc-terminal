// Modo TV: las vistas van rotando solas cada N segundos, encajadas en la pantalla y a pantalla completa,
// para dejar Arc Terminal puesto en un monitor. Como un store de Pinia: estado compartido + funciones.
// El temporizador lo mueve el layout con tickTv(); al tocar la pantalla se pausa y con Esc se sale.
import { applyFit } from './fit.svelte.ts';

export const tv = $state({
	on: false,
	paused: false,
	codes: [] as string[],
	seconds: 30,
	/** Vista actual dentro de `codes`. */
	index: 0,
	/** Segundos que lleva la vista actual. */
	elapsed: 0
});

/** Si la pantalla completa la hemos puesto nosotros (para quitarla al salir). */
let ownFullscreen = false;

export function startTv(codes: string[], seconds: number) {
	Object.assign(tv, { on: true, paused: false, codes, seconds, index: 0, elapsed: 0 });
	document.documentElement.dataset.tv = '';
	applyFit(true);
	// Solo funciona si viene de un toque o una tecla; si el navegador no deja, se sigue sin ella.
	if (!document.fullscreenElement) {
		document.documentElement
			.requestFullscreen?.()
			.then(() => {
				ownFullscreen = true;
				document.addEventListener('fullscreenchange', onFullscreenChange);
			})
			.catch(() => {});
	}
}

/**
 * El primer Esc en pantalla completa lo usa el navegador para salir de ella y la página no lo ve: si quien sale es
 * la pantalla completa que puso el modo TV, se sale también del modo TV.
 */
function onFullscreenChange() {
	if (document.fullscreenElement) return;
	document.removeEventListener('fullscreenchange', onFullscreenChange);
	if (ownFullscreen && tv.on) {
		ownFullscreen = false;
		stopTv();
	}
}

export function stopTv() {
	tv.on = false;
	tv.paused = false;
	delete document.documentElement.dataset.tv;
	applyFit();
	document.removeEventListener('fullscreenchange', onFullscreenChange);
	if (ownFullscreen && document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
	ownFullscreen = false;
}

/** Avanza el reloj `dt` segundos. Devuelve el código de la vista siguiente si toca cambiar. */
export function tickTv(dt: number): string | null {
	if (!tv.on || tv.paused || !tv.codes.length) return null;
	tv.elapsed += dt;
	if (tv.elapsed < tv.seconds) return null;
	tv.elapsed = 0;
	tv.index = (tv.index + 1) % tv.codes.length;
	return tv.codes[tv.index];
}

export function togglePause() {
	tv.paused = !tv.paused;
}
