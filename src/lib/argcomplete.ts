// Autocompletar el argumento de un comando en la barra: «LIDER », «PAIS ale», «FUEL mad», «CMP NVDA A»,
// «TV TOP,W». Lógica pura, sin Svelte, para probarla con Vitest. Las funciones de un valor («NVDA G»)
// van aparte, en functionOptions de cmdline.ts.
import { findCommand, norm, type Option } from './cmdline.ts';
import { COMMANDS, type Command } from './commands.ts';
import { COUNTRIES, demonymForms } from './countries.ts';
import { LEADERS } from './leaders.ts';
import { SHORTCUTS } from './gseries.ts';
import { PROVINCES } from './provinces.ts';
import { TICKERS } from './tickers.ts';

/** Una opción posible para el argumento: lo que se muestra, con qué se encuentra y qué se escribe. */
interface Choice {
	code: string;
	desc: string;
	/** Formas de encontrarla, ya sin tildes y en mayúsculas. */
	keys: string[];
	/** El argumento que se ejecuta («lagarde», «DE», «28»). */
	value: string;
}

const choice = (code: string, desc: string, keys: string[], value: string): Choice => ({
	code,
	desc,
	keys: [code, ...keys].map(norm),
	value
});

/** Las opciones de cada comando que acepta texto, por su código. Se calculan al primer uso. */
const SOURCES: Record<string, { kind: string; list: () => Choice[] }> = {
	LIDER: {
		kind: 'Líder',
		list: () => LEADERS.map((l) => choice(l.id.toUpperCase(), `${l.name} · ${l.role}`, [l.name, ...l.aliases], l.id))
	},
	PAIS: {
		kind: 'País',
		list: () =>
			COUNTRIES.map((c) =>
				choice(c.code, c.name, [c.iso3, c.name, ...(c.aliases ?? []), ...demonymForms(c.demonym)], c.code)
			)
	},
	FUEL: {
		kind: 'Provincia',
		list: () => [
			choice('MENORCA', 'Menorca (la isla)', [], 'Menorca'),
			...PROVINCES.map((p) => choice(p.id, p.name, [p.name], p.id))
		]
	},
	CMP: { kind: 'Valor', list: () => TICKERS.map((t) => choice(t.code, t.name, [t.name], t.code)) },
	G: { kind: 'Serie', list: () => SHORTCUTS.map((s) => choice(s.code, s.name, [s.name, ...(s.keys ?? [])], s.code)) },
	TV: { kind: 'Vista', list: () => COMMANDS.map((c) => choice(c.code, c.desc, c.aliases ?? [], c.code)) }
};

const cache = new Map<string, Choice[]>();
const choices = (code: string) => {
	if (!cache.has(code)) cache.set(code, SOURCES[code]?.list() ?? []);
	return cache.get(code)!;
};

/**
 * Lo que se completa: el comando, lo que va antes de la palabra que se escribe y esa palabra.
 * CMP completa la última palabra («CMP NVDA A») y TV el último código tras la coma («TV TOP,W»).
 */
function parts(raw: string): { command: Command; before: string; word: string } | null {
	const m = raw.trimStart().match(/^(\S+)\s+(.*)$/s);
	if (!m || (m[2].trim() && findCommand(raw.trim()))) return null; // «wall street» es un alias entero
	const command = findCommand(m[1]);
	if (!command?.arg || !SOURCES[command.code]) return null;
	const arg = m[2];
	const cut =
		command.code === 'CMP' ? arg.search(/\S*$/) : command.code === 'TV' || command.code === 'G' ? arg.lastIndexOf(',') + 1 : 0;
	return { command, before: arg.slice(0, cut), word: arg.slice(cut).trim() };
}

/**
 * Sugerencias para el argumento de un comando, o null si lo escrito no es un comando que se pueda
 * completar seguido de un espacio. Primero las que empiezan por lo escrito y después las que lo contienen.
 * Si no encaja ninguna, null: la barra sigue como siempre («LIDER Macron» abre LIDER con ese texto).
 */
export function argOptions(raw: string, limit = 8): Option[] | null {
	const p = parts(raw);
	if (!p) return null;
	const { command, before, word } = p;
	const q = norm(word);
	const rank = (c: Choice) => (!q || c.keys.some((k) => k.startsWith(q)) ? 0 : c.keys.some((k) => k.includes(q)) ? 1 : -1);
	const list = choices(command.code)
		.map((c) => ({ c, r: rank(c) }))
		.filter((x) => x.r >= 0)
		.sort((a, b) => a.r - b.r)
		.slice(0, limit)
		.map(({ c }) => ({ code: c.code, desc: c.desc, kind: SOURCES[command.code].kind, run: `${command.code} ${before}${c.value}` }));
	return list.length ? list : null;
}
