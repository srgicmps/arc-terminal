// Cronómetro y temporizador del Reloj, fuera de los componentes: siguen contando al cambiar de pestaña del Reloj
// y al cerrar su ventana (antes se ponían a cero). Duran mientras Arc OS esté abierto (no sobreviven a recargar).
// Cuentan con la hora del sistema (Date.now), así no se desvían aunque el navegador frene la pestaña.
import { os } from '../../os.svelte.ts';
import { beep, notifySystem } from './alarms.svelte.ts';

export const sw = $state({
	/** ms acumulados antes del último «Seguir». */
	base: 0,
	/** Cuándo se pulsó «Empezar» o «Seguir»; null si está parado. */
	since: null as number | null,
	laps: [] as number[]
});

export const timer = $state({
	min: 5,
	sec: 0,
	/** Cuándo termina (Date.now), o null si no está en marcha. */
	end: null as number | null
});

/** Lo que lleva el cronómetro en `now`. */
export const swElapsed = (now: number) => sw.base + (sw.since === null ? 0 : now - sw.since);

export function swStart() {
	if (sw.since === null) sw.since = Date.now();
}
export function swStop() {
	sw.base = swElapsed(Date.now());
	sw.since = null;
}
export function swReset() {
	sw.base = 0;
	sw.since = null;
	sw.laps = [];
}
export function swLap() {
	sw.laps = [swElapsed(Date.now()), ...sw.laps];
}

let done: ReturnType<typeof setTimeout> | undefined;

export function timerStart() {
	const total = (Math.max(0, Number(timer.min) || 0) * 60 + Math.max(0, Number(timer.sec) || 0)) * 1000;
	if (total <= 0) return;
	timer.end = Date.now() + total;
	// Un solo setTimeout hasta el final: el navegador lo frena menos que un setInterval en segundo plano.
	clearTimeout(done);
	done = setTimeout(finish, total);
}

function finish() {
	if (timer.end === null) return;
	// Si el navegador lo ha despertado antes de tiempo, se espera lo que falte.
	const left = timer.end - Date.now();
	if (left > 50) {
		done = setTimeout(finish, left);
		return;
	}
	timer.end = null;
	const text = '⏲ Temporizador terminado';
	os.notice = { text, at: Date.now() };
	beep();
	notifySystem(text);
}

export function timerCancel() {
	clearTimeout(done);
	timer.end = null;
}
