// Palabras vigiladas del BOE («Menorca», «vivienda»…), guardadas en este navegador como la lista MIS.
// Si el navegador no deja guardar (modo privado…), siguen en memoria mientras dure la visita.
import type { BoeData } from './types.ts';
import { countWatchedToday, fold } from './watchwords.ts';

export { highlight, matches, watched } from './watchwords.ts';

const KEY = 'arc-watchwords';
/** Las de la primera visita, hasta que se cambien. */
const DEFAULT = ['Menorca', 'Illes Balears', 'vivienda'];

export const watchwords = $state({ words: [...DEFAULT], ready: false });

/** Se llama al abrir la vista (BOE, TOP…); la segunda vez no hace nada. */
export function initWatchwords() {
	if (watchwords.ready) return;
	try {
		const saved = localStorage.getItem(KEY);
		if (saved !== null) {
			const list = JSON.parse(saved);
			if (Array.isArray(list)) watchwords.words = list.filter((w) => typeof w === 'string');
		}
	} catch {}
	watchwords.ready = true;
}

function save() {
	try {
		localStorage.setItem(KEY, JSON.stringify(watchwords.words));
	} catch {}
}

export function addWatchword(word: string) {
	const w = word.trim().replace(/\s+/g, ' ');
	if (!w || watchwords.words.some((x) => fold(x) === fold(w))) return;
	watchwords.words = [...watchwords.words, w];
	save();
}

export function removeWatchword(word: string) {
	watchwords.words = watchwords.words.filter((w) => w !== word);
	save();
}

/** Cuántas disposiciones del BOE de hoy nombran alguna de las palabras guardadas (para TOP). */
export function watchedToday(boe: BoeData | undefined, now = Date.now()): number {
	return countWatchedToday(boe, watchwords.words, now);
}
