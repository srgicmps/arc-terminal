// Lógica de la barra de comandos, sin Svelte: qué sugerir y qué abrir con lo que escribe Sergi.
// Va aparte del componente para poder probarla con Vitest.

import { COMMANDS, type Command } from './commands.ts';
import { FUNCTIONS, findFunction } from './functions.ts';
import { panelHash } from './panelhash.ts';
import { parseDay } from './cmddate.ts';
import { evaluate, formatResult, parseConversion, plainResult } from './calc.ts';
import { convert } from './fx.ts';
import { fxLive, loadFxRates } from './fxlive.svelte.ts';
import { longDay, weekday } from './format.ts';
import { madridDate } from './meetings.ts';
import { TICKERS } from './tickers.ts';

/** Una sugerencia de la barra. */
export interface Option {
	code: string;
	desc: string;
	kind: string;
	/** Otras formas de encontrarla (alias en español). */
	aliases?: string[];
	/** Lo que se ejecuta al elegirla, si no es el código (p. ej. una entrada del historial). */
	run?: string;
	/** Enlace a otra web (resultados de búsqueda: titulares y BOE). Se abre en una pestaña nueva. */
	url?: string;
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

/** Un código de Bloomberg («WEI», «fxc»): su comando y, si lo tiene, el panel al que va (M45). */
export function findBloomberg(raw: string): { command: Command; panel?: string } | undefined {
	const q = norm(raw);
	for (const command of COMMANDS) {
		const b = command.bloomberg?.find((x) => x.code === q);
		if (b) return { command, panel: b.panel };
	}
	return undefined;
}

/** Los códigos de Bloomberg como sugerencias: «FXC · Divisas · WS (Bloomberg)». */
const BLOOMBERG: Option[] = COMMANDS.flatMap((c) =>
	(c.bloomberg ?? []).map((b) => ({ code: b.code, desc: `${b.panel ? `${b.panel} · ` : ''}${c.code} (Bloomberg)`, kind: 'Bloomberg' }))
);

/**
 * Calculadora y conversor (M46). «=1250*1.21» da la cuenta; «100 USD EUR», el cambio con los tipos del BCE
 * (se descargan la primera vez: mientras, «Cargando…»). `next` es lo que se deja en la barra al pulsar Intro
 * para seguir calculando («=1512.5»); en una conversión, Intro no hace nada. Null si no es ni una cosa ni otra.
 */
export function calcInput(raw: string): { text: string; desc: string; next?: string } | null {
	const text = raw.trim();
	if (text.startsWith('=')) {
		const expr = text.slice(1).trim();
		if (!expr) return { text: '=', desc: 'Calculadora: escribe una cuenta, p. ej. =1250*1,21' };
		const v = evaluate(expr);
		return v === null
			? { text: '= ?', desc: `No entiendo «${expr}»` }
			: { text: `= ${formatResult(v)}`, desc: expr, next: `=${plainResult(v)}` };
	}
	const fx = parseConversion(text);
	if (!fx) return null;
	loadFxRates();
	const { amount, from, to } = fx;
	if (!fxLive.rates) return { text: `${from} → ${to}`, desc: fxLive.status === 'error' ? 'No se pudieron cargar los cambios del BCE' : 'Cargando los cambios del BCE…' };
	const v = convert(amount, from, to, fxLive.rates);
	if (v === null) {
		const known = [...fxLive.rates.keys()].sort().join(', ');
		return { text: `${from} → ${to}`, desc: `Divisas con cambio del BCE: ${known}` };
	}
	const date = fxLive.rates.get(from === 'EUR' ? to : from)?.date;
	return { text: `${formatResult(amount)} ${from} = ${formatResult(Number(v.toFixed(4)))} ${to}`, desc: `Cambio de referencia del BCE${date ? ` · ${date}` : ''}` };
}

/**
 * Sugerencias para lo escrito, por orden: el código exacto, los códigos que empiezan igual,
 * los alias que empiezan igual y, al final, los que lo contienen en un alias o en la descripción.
 */
export function suggest(raw: string, all: Option[], limit = 8): Option[] {
	const q = norm(raw);
	if (!q) return [];
	// «=1250*1.21», «100 USD EUR»: el resultado, como única sugerencia (sin `run`: no abre nada).
	const calc = calcInput(raw);
	if (calc) return [{ code: calc.text, desc: calc.desc, kind: 'Calculadora' }];
	// «ECO ?»: la ayuda del comando.
	const help = commandHelp(raw);
	if (help) return [helpOption(help, 'Ayuda')];
	// «LUZ mañana»: el comando en ese día.
	const dated = commandDay(raw);
	if (dated) return [dayOption(dated, 'Fecha')];
	// «ECO TIP»: los paneles del comando que coinciden; «NEWS inflación»: ejecutar el comando con ese texto
	// (y, detrás, los paneles que coincidan).
	const panels = panelOptions(raw);
	const withArg = commandWithArg(raw);
	if (withArg) {
		const arg = argOption(withArg.command, withArg.arg, 'Función');
		// Con el título entero («WX Mar»), Intro va al panel: sale el primero.
		const list = commandPanel(raw) ? [...(panels ?? []), arg] : [arg, ...(panels ?? [])];
		return list.slice(0, limit);
	}
	if (panels) return panels.slice(0, limit);
	// «NVDA » o «NVDA G»: las funciones del valor (GP, DES…).
	const fns = functionOptions(raw);
	if (fns) return fns;
	const rank = (o: Option) => {
		const aliases = (o.aliases ?? []).map(norm);
		if (o.code === q) return 0;
		if (o.code.startsWith(q)) return 1;
		if (aliases.some((a) => a.startsWith(q))) return 2;
		if (aliases.some((a) => a.includes(q)) || norm(o.desc).includes(q)) return 3;
		return -1;
	};
	// Los códigos de Bloomberg solo salen al escribir el código (por el principio), no por la descripción.
	const bloomberg = BLOOMBERG.filter((o) => o.code.startsWith(q));
	return [...all, ...bloomberg]
		.map((o) => ({ o, r: rank(o) }))
		.filter((x) => x.r >= 0)
		.sort((a, b) => a.r - b.r)
		.slice(0, limit)
		.map((x) => x.o);
}

/**
 * Lo que abre la barra: una función o la ficha de un valor. `fn` es la función del valor en minúsculas
 * («gp» en «NVDA GP», ver src/lib/functions.ts).
 */
export type Target =
	| { kind: 'command'; command: Command; arg?: string; panel?: string; day?: string }
	| { kind: 'help'; command: Command }
	| { kind: 'symbol'; sym: string; fn?: string };

/**
 * «NVDA GP», «bme:rep des»: un valor y una de sus funciones. Los comandos ganan: «ES GP» no llega aquí
 * (resolveInput mira antes los comandos); para ese valor se escribe la bolsa delante, «NYSE:ES GP».
 */
export function symbolFunction(raw: string): { sym: string; fn: string } | null {
	const parts = raw.trim().split(/\s+/);
	if (parts.length !== 2 || !isTickerLike(parts[0]) || findCommand(parts[0])) return null;
	const fn = findFunction(parts[1]);
	return fn ? { sym: norm(parts[0]), fn: fn.code.toLowerCase() } : null;
}

/**
 * Sugerencias de funciones cuando se escribe un valor y un espacio («NVDA », «NVDA G»), o null si lo
 * escrito no tiene esa forma (o la primera palabra es un comando).
 */
export function functionOptions(raw: string): Option[] | null {
	const m = raw.trimStart().match(/^(\S+)\s+(\S*)$/);
	if (!m || !isTickerLike(m[1]) || findCommand(m[1])) return null;
	const sym = norm(m[1]);
	const q = norm(m[2]);
	const name = TICKERS.find((t) => t.code === sym)?.name;
	// Con solo el espacio («aranceles »), únicamente si es un valor conocido o lleva bolsa («BME:REP »).
	if (!q && !name && !/[:.]/.test(sym)) return null;
	const list = FUNCTIONS.filter((f) => f.code.startsWith(q)).map((f) => ({
		code: `${sym} ${f.code}`,
		desc: name ? `${f.desc} · ${name}` : f.desc,
		kind: 'Función',
		run: `${sym} ${f.code}`
	}));
	return list.length ? list : null;
}

/** «NEWS inflación», «gasolina Madrid»: un comando que acepta texto, seguido del texto. */
export function commandWithArg(raw: string): { command: Command; arg: string } | null {
	if (findCommand(raw)) return null; // «wall street» es un alias entero, no WALL + «street»
	const { head, arg } = splitInput(raw);
	const command = findCommand(head);
	return command?.arg && arg ? { command, arg } : null;
}

/** Las palabras de un texto, normalizadas: «Curvas de tipos» → CURVAS, DE, TIPOS. */
const words = (s: string) => norm(s).split(/[^A-Z0-9]+/).filter(Boolean);

/**
 * Los paneles de un comando a los que lleva un texto, por orden: el título o una key enteros, luego los que
 * coinciden por el título y al final por sus `keys`. Cada palabra escrita tiene que ser el principio de una palabra del título («CURVA» → «Curvas de
 * tipos»). Con `exact`, el texto tiene que ser el título (o una key) entero: así «WX Mar» va al panel, pero
 * «WX Mar del Plata» sigue siendo un lugar.
 */
export function findPanels(command: Command, raw: string, exact = false): string[] {
	const q = words(raw);
	if (!q.length) return [];
	const whole = (text: string) => words(text).join(' ') === q.join(' ');
	const starts = (text: string) => !exact && q.every((x) => words(text).some((y) => y.startsWith(x)));
	const panels = command.manual?.panels ?? [];
	const names = (p: (typeof panels)[number]) => [p.name, ...(p.keys ?? [])];
	const ranked = [
		...panels.filter((p) => names(p).some(whole)),
		...panels.filter((p) => starts(p.name)),
		...panels.filter((p) => p.keys?.some(starts))
	];
	return [...new Set(ranked.map((p) => p.name))];
}

/**
 * «ECO TIPOS», «WS curva»: un comando y uno de sus paneles. En los comandos que aceptan texto, el panel tiene
 * que ir entero (si no, el texto es del comando: «FUEL Madrid», «NEWS paro»).
 */
export function commandPanel(raw: string): { command: Command; panel: string } | null {
	if (findCommand(raw)) return null;
	const { head, arg } = splitInput(raw);
	const command = findCommand(head);
	const panel = command && arg ? findPanels(command, arg, !!command.arg)[0] : undefined;
	return command && panel ? { command, panel } : null;
}

/** Sugerencias de paneles para «ECO TIP», o null si no hay ninguno. */
function panelOptions(raw: string): Option[] | null {
	if (findCommand(raw)) return null;
	const { head, arg } = splitInput(raw);
	const command = findCommand(head);
	if (!command || !arg) return null;
	const list = findPanels(command, arg).map((name) => panelOption(command, name, 'Panel'));
	return list.length ? list : null;
}

function panelOption(command: Command, name: string, kind: string): Option {
	const what = command.manual?.panels?.find((p) => p.name === name)?.what;
	return { code: `${command.code} ${name}`, desc: what ? `Panel · ${what}` : 'Panel', kind, run: `${command.code} ${name}` };
}

/**
 * «LUZ mañana», «CAL viernes»: un comando que acepta días (`date`) y el día («AAAA-MM-DD»). `arg` es lo
 * escrito, que es lo que se guarda en el historial: «LUZ mañana» sigue siendo mañana otro día.
 */
export function commandDay(raw: string, now = Date.now()): { command: Command; arg: string; day: string } | null {
	const { head, arg } = splitInput(raw);
	const command = findCommand(head);
	const day = command?.date && arg ? parseDay(arg, madridDate(now)) : null;
	return command && day ? { command, arg, day } : null;
}

function dayOption(target: { command: Command; arg: string; day: string }, kind: string): Option {
	const { command, arg, day } = target;
	return { code: `${command.code} ${arg}`, desc: `${command.key} · ${weekday(day)}`, kind, run: `${command.code} ${arg}` };
}

/** «ECO ?»: la ayuda de un comando (su ficha del MANUAL). */
export function commandHelp(raw: string): Command | null {
	const { head, arg } = splitInput(raw);
	return arg === '?' ? (findCommand(head) ?? null) : null;
}

function helpOption(command: Command, kind: string): Option {
	return { code: `${command.code} ?`, desc: `Ayuda de ${command.code} en el MANUAL`, kind, run: `${command.code} ?` };
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
	const bloomberg = findBloomberg(q);
	if (bloomberg) return { kind: 'command', ...bloomberg };
	const help = commandHelp(raw);
	if (help) return { kind: 'help', command: help };
	const dated = commandDay(raw);
	if (dated) return { kind: 'command', ...dated };
	const panel = commandPanel(raw);
	if (panel) return { kind: 'command', ...panel };
	const withArg = commandWithArg(raw);
	if (withArg) return { kind: 'command', ...withArg };
	// Un comando sin argumento seguido de texto («ECO paro»): abre el comando.
	const head = findCommand(splitInput(raw).head);
	if (head) return { kind: 'command', command: head };
	// «NVDA GP»: la ficha del valor con esa función.
	const fn = symbolFunction(raw);
	if (fn) return { kind: 'symbol', ...fn };
	const pick = (isTickerLike(q) && suggestions.find((o) => o.code === q)) || suggestions[0];
	if (pick) return resolveInput(pick.run ?? pick.code, []);
	return { kind: 'symbol', sym: q };
}

/** Cómo se guarda en el historial: «FUEL», «NEWS inflación», «NVDA». */
export function canonical(target: Target): string {
	if (target.kind === 'symbol') return target.fn ? `${target.sym} ${target.fn.toUpperCase()}` : target.sym;
	if (target.kind === 'help') return `${target.command.code} ?`;
	if (target.panel) return `${target.command.code} ${target.panel}`;
	return target.arg ? `${target.command.code} ${target.arg}` : target.command.code;
}

/**
 * La ruta y lo que va detrás en la URL: «/news» + «?q=inflaci%C3%B3n», «/eco» + «#panel=Bancos%20centrales».
 * La base la pone el componente.
 */
export function targetPath(target: Target): { route: Command['route'] | '/s' | '/manual'; search: string } {
	if (target.kind === 'symbol') {
		const fn = target.fn ? `&fn=${encodeURIComponent(target.fn)}` : '';
		return { route: '/s', search: `?sym=${encodeURIComponent(target.sym)}${fn}` };
	}
	if (target.kind === 'help') return { route: '/manual', search: `#cmd-${target.command.code}` };
	const { command, arg, panel, day } = target;
	if (panel) return { route: command.route, search: panelHash(panel) };
	if (day) {
		const search = command.date === 'panel' ? panelHash(longDay(`${day}T12:00:00Z`)) : `?dia=${day}`;
		return { route: command.route, search };
	}
	const search = arg && command.arg ? `?${command.arg.param}=${encodeURIComponent(arg)}` : '';
	return { route: command.route, search };
}

/**
 * El enlace del ejemplo de un comando en HELP, igual que si se escribiera en la barra. El texto se
 * separa por palabras, no por la longitud del código: el ejemplo de WX empieza por su alias «LUGAR».
 */
export function exampleTarget(command: Command): { route: Command['route']; search: string } {
	const arg = command.arg ? splitInput(command.arg.example).arg : '';
	const { search } = targetPath({ kind: 'command', command, arg });
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
		const help = commandHelp(entry);
		if (help) return helpOption(help, 'Reciente');
		const dated = commandDay(entry);
		if (dated) return dayOption(dated, 'Reciente');
		const panel = commandPanel(entry);
		if (panel) return panelOption(panel.command, panel.panel, 'Reciente');
		const withArg = commandWithArg(entry);
		if (withArg) return argOption(withArg.command, withArg.arg, 'Reciente');
		const command = findCommand(entry);
		const code = command?.code ?? norm(entry);
		const sf = command ? null : symbolFunction(entry);
		const stock = TICKERS.find((t) => t.code === (sf?.sym ?? code))?.name;
		const desc = command?.desc ?? (sf ? `${findFunction(sf.fn)?.name}${stock ? ` · ${stock}` : ''}` : (stock ?? 'Valor'));
		return { code, desc, kind: 'Reciente', run: entry };
	});
}
