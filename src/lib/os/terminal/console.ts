// App «Terminal» de Arc OS: la barra de comandos como consola. Lógica pura (sin Svelte), para probarla con Vitest.
// Reutiliza lo de la barra: respuestas rápidas (answers.ts), calculadora y conversor (calcInput), sugerencias
// (suggest) y lo que abre cada comando (resolveInput + targetPath). Lo que la barra enseña como sugerencia,
// aquí sale como texto; lo que la barra abre, aquí se abre igual (o en una ventana, si Arc OS lo sabe hacer).

import { calcInput, canonical, findCommand, resolveInput, suggest, targetPath, type Option } from '../../cmdline.ts';
import { answerFor, type AnswerCtx } from '../../bar/answers.ts';
import type { FxState } from '../../fx.ts';

/** Una línea de la salida. `in`: lo que escribiste (con el prompt) · `out`: la respuesta · `err`: no se entiende · `dim`: ayuda. */
export interface Line {
	kind: 'in' | 'out' | 'err' | 'dim';
	text: string;
}

/** Lo que pasa al pulsar Intro. `open`: ruta + búsqueda que hay que abrir · `clear`: limpiar la pantalla · `next`: lo que se deja en el prompt. */
export interface Result {
	lines: Line[];
	open?: { route: string; search: string; label: string };
	clear?: boolean;
	next?: string;
	/** Lo que se guarda en el historial compartido con la barra (arc-cmd-history), si es algo que abre. */
	history?: string;
}

export const PROMPT = 'arc>';

/** Órdenes propias de la consola (además de todos los comandos de la barra). */
export const BUILTINS: { code: string; aliases: string[]; desc: string }[] = [
	{ code: 'ayuda', aliases: ['help', '?'], desc: 'Esta ayuda' },
	{ code: 'limpiar', aliases: ['clear', 'cls'], desc: 'Borra la pantalla (también Ctrl+L)' },
	{ code: 'historial', aliases: ['history'], desc: 'Tus últimos comandos (↑ ↓ los recorren)' },
	{ code: 'fecha', aliases: ['date', 'hora'], desc: 'Fecha y hora de aquí' }
];

const builtin = (raw: string) => {
	const q = raw.trim().toLowerCase();
	return BUILTINS.find((b) => b.code === q || b.aliases.includes(q));
};

export interface ExecCtx {
	answers: AnswerCtx;
	all: Option[];
	fx?: FxState;
	history: string[];
}

/** Ejecuta una línea. Nunca lanza: lo que no se entiende sale como `err`. */
export function execLine(raw: string, ctx: ExecCtx): Result {
	const text = raw.trim();
	const echo: Line = { kind: 'in', text: `${PROMPT} ${text}` };
	if (!text) return { lines: [{ kind: 'in', text: PROMPT }] };

	const b = builtin(text);
	if (b?.code === 'limpiar') return { lines: [], clear: true };
	if (b?.code === 'ayuda') return { lines: [echo, ...helpLines()] };
	if (b?.code === 'historial') {
		const list = ctx.history.slice(0, 20);
		return {
			lines: [echo, ...(list.length ? list.map((h, i) => ({ kind: 'out' as const, text: `${String(i + 1).padStart(3)}  ${h}` })) : [{ kind: 'dim' as const, text: 'Aún no hay historial.' }])]
		};
	}
	if (b?.code === 'fecha') {
		const d = new Date(ctx.answers.now);
		const s = d.toLocaleString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
		return { lines: [echo, { kind: 'out', text: s }] };
	}

	// «=1250*1,21», «100 USD EUR»: el resultado; la cuenta se queda en el prompt para seguir calculando.
	const calc = calcInput(text, ctx.fx);
	if (calc) {
		const bad = calc.text === '= ?';
		return { lines: [echo, { kind: bad ? 'err' : 'out', text: bad ? calc.desc : `${calc.text}   ${calc.desc}` }] };
	}

	// «euribor», «hora tokio», «hipoteca 150000 25a»: el dato, como texto. No se abre la vista: se sugiere.
	const ans = answerFor(text, ctx.answers);
	if (ans) {
		const lines: Line[] = [echo, { kind: 'out', text: `${ans.code}   ${ans.desc}` }];
		if (ans.open) lines.push({ kind: 'dim', text: `Para verlo entero: ${ans.open}` });
		return { lines };
	}

	// Lo demás, como la barra: un comando, un panel, un valor…
	const target = resolveInput(text, suggest(text, ctx.all));
	if (!target) return { lines: [echo, { kind: 'err', text: `No entiendo «${text}». Escribe «ayuda».` }] };
	const { route, search } = targetPath(target);
	const label = canonical(target);
	return { lines: [echo, { kind: 'dim', text: `→ ${label}` }], open: { route, search, label }, history: label };
}

/** La ayuda: las órdenes propias y unos ejemplos de lo que entiende. */
export function helpLines(): Line[] {
	return [
		{ kind: 'out', text: 'Arc Terminal · consola' },
		...BUILTINS.map((b) => ({ kind: 'out' as const, text: `  ${b.code.padEnd(10)} ${b.desc}` })),
		{ kind: 'out', text: '  ECO, WS, NVDA…  Abre una vista o un valor (como la barra)' },
		{ kind: 'out', text: '  =1250*1,21      Calculadora · 100 USD EUR, conversor' },
		{ kind: 'out', text: '  euribor, btc    Respuestas rápidas · hora tokio, prima' },
		{ kind: 'dim', text: 'Tab completa · ↑ ↓ historial · Ctrl+L limpia' }
	];
}

/**
 * Autocompletar con Tab: si solo hay una opción, la escribe (con un espacio detrás si el comando acepta texto);
 * con varias, completa lo común y devuelve la lista para enseñarla.
 */
export function complete(raw: string, all: Option[]): { value: string; list: Option[] } {
	const text = raw.trimStart();
	if (!text) return { value: raw, list: [] };
	const words: Option[] = BUILTINS.filter((b) => b.code.startsWith(text.toLowerCase())).map((b) => ({ code: b.code, desc: b.desc, kind: 'Consola' }));
	const list = [...words, ...suggest(text, all, 8)].filter((o) => !o.url);
	if (!list.length) return { value: raw, list: [] };
	if (list.length === 1) {
		const code = list[0].run ?? list[0].code;
		const cmd = findCommand(code);
		return { value: cmd?.arg && code === cmd.code ? `${code} ` : code, list: [] };
	}
	const codes = list.map((o) => o.run ?? o.code);
	const prefix = commonPrefix(codes);
	return { value: prefix.length > text.length && prefix.toUpperCase().startsWith(text.toUpperCase()) ? prefix : raw, list };
}

/** Lo que tienen en común al principio («WS», «WB» → «W»), sin distinguir mayúsculas. */
export function commonPrefix(list: string[]): string {
	if (!list.length) return '';
	let p = list[0];
	for (const s of list.slice(1)) {
		let i = 0;
		while (i < p.length && i < s.length && p[i].toUpperCase() === s[i].toUpperCase()) i++;
		p = p.slice(0, i);
	}
	return p;
}
