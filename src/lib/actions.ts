// Acciones de la barra (lote 27-B): órdenes que no abren una vista, sino que hacen algo.
// - «compartir WS»: copia (o comparte, en el móvil) el enlace de una vista; «compartir» solo, la abierta.
// - «+NVDA» / «-AAPL»: añade o quita de MIS y de tus valores de AVISOS.
// - «vigila aranceles»: palabra vigilada (BOE y titulares), también para los avisos.
// - «alerta NVDA > 150», «alerta BTC -5%», «alerta diésel < 1,40»: la guarda en tu cuenta (F14).
//   «alertas» (o «alerta» solo) abre AVISOS, donde están todas.
// Lógica pura, sin Svelte, para poder probarla con Vitest; la ejecuta src/lib/runaction.svelte.ts.
import { canonical, norm, resolveInput, splitInput, suggest, targetPath, type Option, type Target } from './cmdline.ts';
import type { ShareInfo } from './share.ts';
import { alertText, cleanWord, parseAlert, type UserAlert } from './useralerts.ts';

/** Palabras que lanzan cada acción (en mayúsculas y sin tildes, como las compara `norm`). */
const SHARE_WORDS = ['COMPARTIR', 'SHARE'];
const WATCH_WORDS = ['VIGILA', 'VIGILAR'];
const ALERT_WORDS = ['ALERTA', 'ALERTAS', 'ALERT'];

export type Action =
	| { kind: 'share'; arg: string }
	| { kind: 'mis'; add: boolean; code: string }
	| { kind: 'watch'; word: string | null; raw: string }
	| { kind: 'alert'; alert: UserAlert | null; raw: string };

/** ¿Es una acción? «compartir WS» → { share, «WS» }. Null si es un comando normal. */
export function parseAction(raw: string): Action | null {
	const text = raw.trim();
	const mis = text.match(/^([+-])\s*([A-Za-z0-9.:]{1,12})$/);
	if (mis) return { kind: 'mis', add: mis[1] === '+', code: mis[2].toUpperCase() };
	const { head, arg } = splitInput(text);
	const h = norm(head);
	if (SHARE_WORDS.includes(h)) return { kind: 'share', arg };
	if (WATCH_WORDS.includes(h)) return { kind: 'watch', word: cleanWord(arg), raw: arg };
	if (ALERT_WORDS.includes(h)) return { kind: 'alert', alert: arg ? parseAlert(arg) : null, raw: arg };
	return null;
}

/** La vista que se comparte: la de lo escrito tras «compartir» (null si no hay nada: la vista abierta). */
export function shareTarget(action: { arg: string }, all: Option[]): Target | null {
	if (!action.arg) return null;
	return resolveInput(action.arg, suggest(action.arg, all));
}

/** Título y ruta (sin la base) de lo que se comparte: «Arc Terminal · WS», «/ws». */
export function shareInfo(target: Target): ShareInfo & ReturnType<typeof targetPath> {
	const { route, search } = targetPath(target);
	const name = target.kind === 'symbol' ? target.sym : target.command.desc;
	return { title: `Arc Terminal · ${canonical(target)}`, text: name, route, search };
}

/** La lista MIS después de «+NVDA» o «-AAPL». */
export function nextMis(codes: string[], action: { add: boolean; code: string }): string[] {
	const rest = codes.filter((c) => c !== action.code);
	return action.add ? [...rest, action.code] : rest;
}

const ACCOUNT = 'se guarda en tu cuenta para los avisos al móvil';

/** La sugerencia de la barra: qué hará Intro. */
export function actionOption(action: Action, raw: string, all: Option[]): Option {
	const base = { kind: 'Acción', run: raw.trim() };
	switch (action.kind) {
		case 'share': {
			const target = shareTarget(action, all);
			const what = target ? canonical(target) : 'esta vista';
			return {
				...base,
				code: target ? `COMPARTIR ${what}` : 'COMPARTIR',
				desc: `Copia el enlace de ${what} (en el móvil, abre el menú de compartir)`
			};
		}
		case 'mis':
			return {
				...base,
				code: `${action.add ? '+' : '−'}${action.code}`,
				desc: `${action.add ? 'Añade a' : 'Quita de'} MIS (y tus valores de AVISOS)`
			};
		case 'watch':
			return action.word
				? { ...base, code: `VIGILA ${action.word}`, desc: `Palabra vigilada (BOE y titulares); ${ACCOUNT}` }
				: { ...base, code: 'VIGILA', desc: action.raw ? `«${action.raw}» no vale (máx. 40 letras)` : 'Escribe una palabra: vigila aranceles' };
		case 'alert':
			if (action.alert) return { ...base, code: `ALERTA ${alertText(action.alert)}`, desc: `Aviso al móvil cuando se cumpla; ${ACCOUNT}` };
			return action.raw
				? { ...base, code: 'ALERTA ?', desc: 'No la entiendo. Ejemplos: alerta NVDA > 150 · alerta BTC -5% · alerta diésel < 1,40' }
				: { ...base, code: 'ALERTAS', desc: 'Tus alertas, en AVISOS. Nueva: alerta NVDA > 150' };
	}
}
