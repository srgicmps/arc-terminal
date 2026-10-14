// Lógica de la barra de comandos, sin Svelte: qué sugerir y qué abrir con lo que escribe Sergi.
// Va aparte del componente para poder probarla con Vitest.

import { COMMANDS, type Command } from './commands.ts';

/** Una sugerencia de la barra. */
export interface Option {
	code: string;
	desc: string;
	kind: string;
}

/** Sin tildes y en mayúsculas, para comparar. */
export const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase();

/** ¿Parece un código de valor (NVDA, BRK.B, BME:REP)? Sin espacios y como mucho 12 caracteres. */
export const isTickerLike = (raw: string) => /^[A-Z0-9.:]{1,12}$/.test(norm(raw));

/** Sugerencias para lo escrito: primero el código exacto, luego los que empiezan igual y después por texto. */
export function suggest(raw: string, all: Option[], limit = 8): Option[] {
	const q = norm(raw);
	if (!q) return [];
	const rank = (o: Option) => (o.code === q ? 0 : o.code.startsWith(q) ? 1 : norm(o.desc).includes(q) ? 2 : -1);
	return all
		.map((o) => ({ o, r: rank(o) }))
		.filter((x) => x.r >= 0)
		.sort((a, b) => a.r - b.r)
		.slice(0, limit)
		.map((x) => x.o);
}

/** Lo que abre la barra: una función o la ficha de un valor. */
export type Target = { kind: 'command'; command: Command } | { kind: 'symbol'; sym: string };

/**
 * Decide qué abrir al pulsar Intro.
 *  1. Un comando exacto (ECO, FUEL…).
 *  2. Si hay sugerencias, la primera (o la que coincide exactamente con un código, si parece un valor).
 *  3. Si no hay ninguna, la ficha del valor: /s?sym=…
 */
export function resolveInput(raw: string, suggestions: Option[]): Target | null {
	const q = norm(raw);
	if (!q) return null;
	const command = COMMANDS.find((c) => c.code === q);
	if (command) return { kind: 'command', command };
	const pick = (isTickerLike(q) && suggestions.find((o) => o.code === q)) || suggestions[0];
	if (pick) return resolveInput(pick.code, []) ?? null;
	return { kind: 'symbol', sym: q };
}
