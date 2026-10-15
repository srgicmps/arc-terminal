// Vista de inicio (2e.10): la que se abre al entrar en Arc Terminal, en lugar de TOP. Se elige en HELP y se
// guarda en el navegador. Solo cuenta al abrir la web (una vez por pestaña): luego TOP y Esc siguen
// llevando a la portada. Lógica pura, para probarla.
import { COMMANDS, type Command } from './commands.ts';

export const HOME_KEY = 'arc-home';
/** En sessionStorage: esta pestaña ya ha pasado por el inicio. */
export const HOME_DONE = 'arc-home-done';

/** Lo que no tiene sentido como inicio: el modo TV, la ayuda y los textos largos. */
const SKIP = new Set(['TV', 'HELP', 'DOC', 'MANUAL', 'NOVEDADES', 'STATUS', 'BIENVENIDA']);

export const homeChoices = (): Command[] => COMMANDS.filter((c) => !SKIP.has(c.code));

export const isHomeCode = (code: string) => homeChoices().some((c) => c.code === code);

/**
 * A qué vista ir al abrir la portada, o null para quedarse en TOP: solo la primera vez en la pestaña,
 * si la portada se abrió sin parámetros (un enlace compartido manda) y si hay otra vista elegida.
 */
export function startCommand(saved: string | null, started: boolean, search: string): Command | null {
	if (started || search || !saved || saved === 'TOP') return null;
	return homeChoices().find((c) => c.code === saved) ?? null;
}
