// Modo TV: lógica pura (se prueba con Vitest). El estado y el temporizador están en tv.svelte.ts.
import { COMMANDS, type Command } from './commands.ts';

/** Vistas que rotan si no se dice otra cosa. */
export const TV_DEFAULT = ['TOP', 'WS', 'GEO', 'LUZ'];
export const TV_SECONDS = 30;
export const TV_MIN = 10;
export const TV_MAX = 600;

/** Comandos que no tiene sentido poner en la tele (texto, ajustes o la propia TV). */
const SKIP = new Set(['TV', 'HELP', 'DOC', 'MIS', 'NEWS', 'CHESS']);

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
