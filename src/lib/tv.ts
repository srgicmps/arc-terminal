// Modo TV: lógica pura (se prueba con Vitest). El estado y el temporizador están en tv.svelte.ts.
import { COMMANDS, type Command } from './commands.ts';

/** Vistas que rotan si no se dice otra cosa. */
export const TV_DEFAULT = ['TOP', 'WS', 'GEO', 'LUZ'];
export const TV_SECONDS = 30;
export const TV_MIN = 10;
export const TV_MAX = 600;

/** Comandos que no tiene sentido poner en la tele (texto, ajustes, la propia TV o PREGUNTA, que es con IA y a petición). */
const SKIP = new Set(['TV', 'HELP', 'MANUAL', 'DOC', 'MIS', 'NEWS', 'CHESS', 'PREGUNTA']);

export const tvCandidates = (): Command[] => COMMANDS.filter((c) => !SKIP.has(c.code));

/**
 * Lee «?tv=TOP,WS,GEO&s=30»: los códigos que existen (sin repetir ni los que no valen) y los segundos,
 * entre 10 y 600. Sin códigos válidos, las vistas de siempre.
 */
export function parseTv(views: string | null, seconds: string | null): { codes: string[]; seconds: number } {
	const valid = new Set(tvCandidates().map((c) => c.code));
	const codes = [
		...new Set(
			(views ?? '')
				.split(/[\s,;]+/)
				.map((c) => c.trim().toUpperCase())
				.filter((c) => valid.has(c))
		)
	];
	const s = Number(seconds);
	return {
		codes: codes.length ? codes : TV_DEFAULT,
		seconds: Number.isFinite(s) && s > 0 ? Math.min(TV_MAX, Math.max(TV_MIN, Math.round(s))) : TV_SECONDS
	};
}

/** La URL que arranca el modo TV, para compartirla o guardarla en favoritos. */
export function tvQuery(codes: readonly string[], seconds: number): string {
	return `?tv=${codes.join(',')}&s=${seconds}`;
}

export function routeOf(code: string): Command['route'] {
	return COMMANDS.find((c) => c.code === code)?.route ?? '/';
}

/**
 * Segundos que han pasado entre dos marcas de performance.now(): tiempo real, no ticks, para que la rotación no
 * se retrase con la CPU cargada. Con la pestaña oculta no cuenta (ni avanza la barra ni cambia de vista).
 */
export const tvDelta = (last: number, now: number, hidden: boolean): number => (hidden ? 0 : Math.max(0, now - last) / 1000);
