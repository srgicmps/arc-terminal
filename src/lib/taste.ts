// «A tu gusto»: la parte sin Svelte (para probarla con Vitest). El estado está en taste.svelte.ts.
import { COMMANDS } from './commands.ts';

export type Accent = 'amber' | 'cyan' | 'blue';

export const ACCENTS: { value: Accent; label: string }[] = [
	{ value: 'amber', label: 'Ámbar' },
	{ value: 'cyan', label: 'Cian' },
	{ value: 'blue', label: 'Azul' }
];

/** Densidad: la compacta de siempre o una más aireada (tokens.css, :root[data-density='comoda']). */
export type Density = 'compacta' | 'comoda';
export const DENSITIES: { value: Density; label: string }[] = [
	{ value: 'compacta', label: 'Compacta' },
	{ value: 'comoda', label: 'Cómoda' }
];

/** Lo que trae la web: la fila de arriba con los comandos fijados y cuatro abajo. */
export const DEFAULT_TOP = COMMANDS.filter((c) => c.pinned).map((c) => c.code);
export const DEFAULT_THUMB = ['TOP', 'ECO', 'WS', 'FUEL'];
/** La barra inferior del móvil tiene sitio para 4 (más el botón «/»). */
export const THUMB_MAX = 4;

/** Solo códigos que existen, sin repetir y en el orden de COMMANDS. */
export function cleanCodes(codes: unknown, max = Infinity): string[] | null {
	if (!Array.isArray(codes)) return null;
	const wanted = new Set(codes.filter((c): c is string => typeof c === 'string'));
	const out = COMMANDS.filter((c) => wanted.has(c.code)).map((c) => c.code).slice(0, max);
	return out.length ? out : null;
}

