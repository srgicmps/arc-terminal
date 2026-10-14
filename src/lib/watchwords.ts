// Coincidencias de palabras vigiladas en el BOE: palabra entera, sin tildes ni mayúsculas.
// Funciones puras (sin $state), para poder probarlas; las usa watchwords.svelte.ts.
import { madridNow } from './power.ts';
import type { BoeData, BoeItem } from './types.ts';

/** Un carácter sin tilde y en minúsculas: «Á» → «a». Va carácter a carácter para no mover posiciones. */
const foldChar = (c: string) => c.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().charAt(0) || c;
export const fold = (s: string) => Array.from(s, foldChar).join('');

/** Expresión que encuentra la palabra entera (no «vivienda» dentro de «viviendas»), sin tildes. */
function pattern(word: string): RegExp | null {
	const w = fold(word.trim());
	if (!w) return null;
	const body = w
		.split(/\s+/)
		.map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
		.join('\\s+');
	return new RegExp(`(?<![\\p{L}\\p{N}])${body}(?![\\p{L}\\p{N}])`, 'gu');
}

/** Trozos del texto marcando los que coinciden con alguna palabra, para resaltarlos. */
export function highlight(text: string, words: string[]): { text: string; hit: boolean }[] {
	// Cada carácter real se convierte en una sola letra: la posición i del texto plegado es el carácter i.
	const chars = Array.from(text);
	const folded = chars.map(foldChar).join('');
	const hits = new Array<boolean>(chars.length).fill(false);
	for (const word of words) {
		const re = pattern(word);
		if (!re) continue;
		for (const m of folded.matchAll(re)) {
			for (let i = m.index; i < m.index + m[0].length; i++) hits[i] = true;
		}
	}
	const parts: { text: string; hit: boolean }[] = [];
	chars.forEach((c, i) => {
		const last = parts.at(-1);
		if (last && last.hit === hits[i]) last.text += c;
		else parts.push({ text: c, hit: hits[i] });
	});
	return parts;
}

/** Las palabras que aparecen en el texto. */
export function matches(text: string, words: string[]): string[] {
	const folded = fold(text);
	return words.filter((w) => pattern(w)?.test(folded));
}

/** Disposiciones que nombran alguna palabra, en el título, el ministerio o el epígrafe. */
export function watched(boe: BoeData | undefined, words: string[]): BoeItem[] {
	if (!boe || !words.length) return [];
	return boe.sections.flatMap((s) => s.items).filter((i) => matches(`${i.title} ${i.dept} ${i.epigraph}`, words).length);
}

/** Cuántas disposiciones del BOE de hoy (hora de Madrid) nombran alguna palabra vigilada. */
export function countWatchedToday(boe: BoeData | undefined, words: string[], now = Date.now()): number {
	if (!boe || boe.date !== madridNow(now).day) return 0;
	return watched(boe, words).length;
}
