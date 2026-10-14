// Lógica de la barra de comandos, sin Svelte: qué sugerir y qué abrir con lo que escribe Sergi.
// Va aparte del componente para poder probarla con Vitest.

import { COMMANDS, TICKERS, type Command } from './commands.ts';

/** Una sugerencia de la barra. */
export interface Option {
	code: string;
	desc: string;
	kind: string;
	/** Otras formas de encontrarla (alias en español). */
	aliases?: string[];
	/** Lo que se ejecuta al elegirla, si no es el código (p. ej. una entrada del historial). */
	run?: string;
}

/** Sin tildes y en mayúsculas, para comparar. */
export const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase();

/** ¿Parece un código de valor (NVDA, BRK.B, BME:REP)? Sin espacios y como mucho 12 caracteres. */
export const isTickerLike = (raw: string) => /^[A-Z0-9.:]{1,12}$/.test(norm(raw));

/** Separa la primera palabra del resto: «NEWS  inflación subyacente» → NEWS + «inflación subyacente». */
export function splitInput(raw: string): { head: string; arg: string } {
	const text = raw.trim();
	const i = text.search(/\s/);
	return i < 0 ? { head: text, arg: '' } : { head: text.slice(0, i), arg: text.slice(i).trim() };
}

/** El comando que corresponde a un texto: por su código o por uno de sus alias. */
export function findCommand(raw: string): Command | undefined {
	const q = norm(raw);
	if (!q) return undefined;
	return COMMANDS.find((c) => c.code === q) ?? COMMANDS.find((c) => c.aliases?.some((a) => norm(a) === q));
}

/**
 * Sugerencias para lo escrito, por orden: el código exacto, los códigos que empiezan igual,
 * los alias que empiezan igual y, al final, los que lo contienen en un alias o en la descripción.
 */
export function suggest(raw: string, all: Option[], limit = 8): Option[] {
	const q = norm(raw);
	if (!q) return [];
	// «NEWS inflación»: la única sugerencia es ejecutar el comando con ese texto.
	const withArg = commandWithArg(raw);
	if (withArg) return [argOption(withArg.command, withArg.arg, 'Función')];
	const rank = (o: Option) => {
		const aliases = (o.aliases ?? []).map(norm);
		if (o.code === q) return 0;
		if (o.code.startsWith(q)) return 1;
		if (aliases.some((a) => a.startsWith(q))) return 2;
		if (aliases.some((a) => a.includes(q)) || norm(o.desc).includes(q)) return 3;
		return -1;
	};
	return all
		.map((o) => ({ o, r: rank(o) }))
		.filter((x) => x.r >= 0)
		.sort((a, b) => a.r - b.r)
		.slice(0, limit)
		.map((x) => x.o);
}

/** Lo que abre la barra: una función o la ficha de un valor. */
export type Target = { kind: 'command'; command: Command; arg?: string } | { kind: 'symbol'; sym: string };

/** «NEWS inflación», «gasolina Madrid»: un comando que acepta texto, seguido del texto. */
function commandWithArg(raw: string): { command: Command; arg: string } | null {
	if (findCommand(raw)) return null; // «wall street» es un alias entero, no WALL + «street»
	const { head, arg } = splitInput(raw);
	const command = findCommand(head);
	return command?.arg && arg ? { command, arg } : null;
}

function argOption(command: Command, arg: string, kind: string): Option {
	return { code: command.code, desc: `${command.arg?.label}: ${arg}`, kind, run: `${command.code} ${arg}` };
}

/**
 * Decide qué abrir al pulsar Intro.
 *  1. Un comando exacto, por código o alias (ECO, gasolina, wall street…).
 *  2. Si hay sugerencias, la primera (o la que coincide exactamente con un código, si parece un valor).
 *  3. Si no hay ninguna, la ficha del valor: /s?sym=…
 */
export function resolveInput(raw: string, suggestions: Option[]): Target | null {
	const q = norm(raw);
	if (!q) return null;
	const command = findCommand(q);
	if (command) return { kind: 'command', command };
	const withArg = commandWithArg(raw);
	if (withArg) return { kind: 'command', ...withArg };
	// Un comando sin argumento seguido de texto («ECO paro»): abre el comando.
	const head = findCommand(splitInput(raw).head);
	if (head) return { kind: 'command', command: head };
	const pick = (isTickerLike(q) && suggestions.find((o) => o.code === q)) || suggestions[0];
	if (pick) return resolveInput(pick.run ?? pick.code, []);
	return { kind: 'symbol', sym: q };
}

/** Cómo se guarda en el historial: «FUEL», «NEWS inflación», «NVDA». */
export function canonical(target: Target): string {
	if (target.kind === 'symbol') return target.sym;
	return target.arg ? `${target.command.code} ${target.arg}` : target.command.code;
}

/** La ruta y la búsqueda de la URL: «/news» + «?q=inflaci%C3%B3n». La base la pone el componente. */
export function targetPath(target: Target): { route: Command['route'] | '/s'; search: string } {
	if (target.kind === 'symbol') return { route: '/s', search: `?sym=${encodeURIComponent(target.sym)}` };
	const { command, arg } = target;
	const search = arg && command.arg ? `?${command.arg.param}=${encodeURIComponent(arg)}` : '';
	return { route: command.route, search };
}

// ---- Historial: los últimos comandos, guardados en este navegador ----

export const HISTORY_KEY = 'arc-cmd-history';
export const HISTORY_MAX = 5;

/** Añade una entrada al principio, sin repetirla y con un máximo de 5. */
export function pushHistory(list: string[], entry: string): string[] {
	const e = entry.trim();
	if (!e) return list;
	return [e, ...list.filter((x) => norm(x) !== norm(e))].slice(0, HISTORY_MAX);
}

type Store = Pick<Storage, 'getItem' | 'setItem'>;
/** localStorage, si existe (no existe al prerenderizar y puede fallar en modo privado). */
const browserStore = (): Store | undefined => globalThis.localStorage;

export function readHistory(store: () => Store | undefined = browserStore): string[] {
	try {
		const saved: unknown = JSON.parse(store()?.getItem(HISTORY_KEY) ?? '[]');
		if (!Array.isArray(saved)) return [];
		return saved.filter((x): x is string => typeof x === 'string' && x.trim() !== '').slice(0, HISTORY_MAX);
	} catch {
		return [];
	}
}

export function writeHistory(list: string[], store: () => Store | undefined = browserStore): void {
	try {
		store()?.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, HISTORY_MAX)));
	} catch {}
}

/** Las entradas del historial como sugerencias: «FUEL · Gasolineras…», «NVDA · NVIDIA». */
export function historyOptions(list: string[]): Option[] {
	return list.map((entry) => {
		const withArg = commandWithArg(entry);
		if (withArg) return argOption(withArg.command, withArg.arg, 'Reciente');
		const command = findCommand(entry);
		const code = command?.code ?? norm(entry);
		const desc = command?.desc ?? TICKERS.find((t) => t.code === code)?.name ?? 'Valor';
		return { code, desc, kind: 'Reciente', run: entry };
	});
}
