// Reloj de ajedrez opcional (CHESS), como funciones puras: reciben la hora («now», en ms) y devuelven un
// reloj nuevo. Corre desde la primera jugada de las blancas. Al volver a la página se pone en pausa: el
// tiempo que la pestaña ha estado cerrada no cuenta.
import type { Color } from './game.ts';

export interface Clock {
	/** Tiempo inicial e incremento por jugada, en ms. */
	base: number;
	inc: number;
	/** Lo que le queda a cada bando al empezar su turno. */
	w: number;
	b: number;
	/** Desde cuándo corre el turno actual, o null si está parado. */
	since: number | null;
}

/** Ritmos que se pueden elegir. El valor es «minutos+segundos». */
export const PRESETS = [
	{ value: 'none', label: 'Sin reloj' },
	{ value: '5+3', label: '5+3' },
	{ value: '10+0', label: '10+0' },
	{ value: '15+10', label: '15+10' },
	{ value: '30+0', label: '30+0' }
] as const;

export type Preset = (typeof PRESETS)[number]['value'];

export function makeClock(preset: Preset): Clock | null {
	const m = /^(\d+)\+(\d+)$/.exec(preset);
	if (!m) return null;
	const base = Number(m[1]) * 60_000;
	return { base, inc: Number(m[2]) * 1000, w: base, b: base, since: null };
}

/** Tiempo que le queda ahora al bando `color`, si es su turno (`turn`). Nunca negativo. */
export function remaining(clock: Clock, color: Color, turn: Color, now: number): number {
	const left = clock[color] - (color === turn && clock.since !== null ? now - clock.since : 0);
	return Math.max(0, left);
}

/** Después de que `mover` juegue: le descuenta lo que ha pensado, le suma el incremento y arranca al rival. */
export function afterMove(clock: Clock, mover: Color, now: number): Clock {
	const next = { ...clock };
	if (clock.since !== null) next[mover] = Math.max(0, clock[mover] - (now - clock.since)) + clock.inc;
	next.since = now;
	return next;
}

/** Para el reloj guardando lo que lleva consumido el turno actual (al acabar o al salir). */
export function pause(clock: Clock, turn: Color, now: number): Clock {
	if (clock.since === null) return clock;
	return { ...clock, [turn]: remaining(clock, turn, turn, now), since: null };
}

/** El bando que se ha quedado sin tiempo, si alguno. */
export function flagged(clock: Clock, turn: Color, now: number): Color | null {
	return clock.since !== null && remaining(clock, turn, turn, now) <= 0 ? turn : null;
}

/** «4:59», o «0:09.4» en los últimos 10 segundos. */
export function formatClock(ms: number): string {
	const s = Math.max(0, ms) / 1000;
	// Hacia abajo, como un reloj de verdad: 9,96 s es «0:09.9», no «0:10.0».
	if (s < 10) return `0:0${(Math.floor(s * 10) / 10).toFixed(1)}`;
	const whole = Math.ceil(s);
	const min = Math.floor(whole / 60);
	return `${min}:${String(whole % 60).padStart(2, '0')}`;
}
