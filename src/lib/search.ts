// Búsqueda de la barra de comandos en el índice static/data/search.json (scripts/sources/search.ts).
// Lógica pura, sin Svelte, para probarla con Vitest. El índice se carga aparte, en diferido.
import { commandWithArg, findCommand, isTickerLike, norm, splitInput, type Option } from './cmdline.ts';
import type { SearchEntry } from './types.ts';

/** Una entrada lista para buscar: con su título ya normalizado (sin tildes y en mayúsculas). */
export interface Indexed extends SearchEntry {
	n: string;
}

/** Normaliza los títulos una sola vez, al cargar el índice. */
export function prepare(entries: SearchEntry[]): Indexed[] {
	return entries.filter((e) => e && typeof e.t === 'string' && typeof e.u === 'string').map((e) => ({ ...e, n: norm(e.t) }));
}

/** Por debajo de estas letras no se busca: «a» o «de» salen en todo. */
export const MIN_QUERY = 3;

const isWordStart = (text: string, at: number) => at === 0 || !/[\p{L}\p{N}]/u.test(text[at - 1]);

/**
 * Entradas que contienen todas las palabras de lo escrito (AND), sin tildes ni mayúsculas.
 * Orden: 0 el título empieza por lo escrito · 1 empieza por la primera palabra · 2 todas las palabras
 * empiezan una palabra del título · 3 el resto. A igualdad, el orden del índice (lo más nuevo antes).
 */
export function searchIndex(raw: string, index: Indexed[], limit = 5): Indexed[] {
	const q = norm(raw).replace(/\s+/g, ' ');
	if (q.replace(/ /g, '').length < MIN_QUERY) return [];
	const words = q.split(' ');
	const ranked: { e: Indexed; r: number; i: number }[] = [];
	index.forEach((e, i) => {
		const at = words.map((w) => e.n.indexOf(w));
		if (at.some((p) => p < 0)) return;
		const r = e.n.startsWith(q)
			? 0
			: at[0] === 0
				? 1
				: words.every((w) => {
						for (let p = e.n.indexOf(w); p >= 0; p = e.n.indexOf(w, p + 1)) if (isWordStart(e.n, p)) return true;
						return false;
					})
					? 2
					: 3;
		ranked.push({ e, r, i });
	});
	return ranked
		.sort((a, b) => a.r - b.r || a.i - b.i)
		.slice(0, limit)
		.map((x) => x.e);
}

/** El valor de un enlace interno a una ficha («/s?sym=NVDA» → «NVDA»), o null si es otro enlace. */
export function symbolOf(url: string): string | null {
	const m = /^\/s\?sym=([^&#]+)/.exec(url);
	return m ? decodeURIComponent(m[1]) : null;
}

/** ¿Es un enlace a otra web? Solo se abren http(s); nada de «javascript:» que pudiera colarse en un feed. */
export const isExternal = (url: string) => /^https?:\/\//i.test(url);

/** Un código corto (NVDA, REP) puede ser un valor que no está en la lista: se ofrece su ficha antes. */
const TICKER_MAX = 5;

/**
 * Resultados de búsqueda que se añaden debajo de las sugerencias de comandos. No se busca si lo escrito
 * ya es un comando («ECO», «gasolina»), un comando con texto («NEWS inflación») o empieza por un comando
 * («ECO paro»): ahí Intro abre ese comando, como siempre.
 *
 * Si no hay sugerencias y lo escrito parece un código de valor corto (como mucho 5 caracteres), la primera
 * fila es la ficha de ese valor: así Intro hace lo mismo que antes de existir la búsqueda.
 */
export function searchOptions(raw: string, suggestions: Option[], index: Indexed[] | null, limit = 5): Option[] {
	if (!index?.length || !raw.trim()) return [];
	if (findCommand(raw) || commandWithArg(raw) || findCommand(splitInput(raw).head)) return [];
	const listed = new Set(suggestions.map((o) => o.code));
	const hits: Option[] = [];
	for (const e of searchIndex(raw, index, limit + listed.size)) {
		if (e.s === 'Valor') {
			const sym = symbolOf(e.u);
			if (!sym || listed.has(sym)) continue;
			hits.push({ code: sym, desc: e.t.replace(/^\S+ · /, ''), kind: 'Valor', run: sym });
		} else if (isExternal(e.u)) {
			hits.push({ code: e.s, desc: e.t, kind: '↗', url: e.u });
		}
		if (hits.length >= limit) break;
	}
	const q = norm(raw);
	if (hits.length && !suggestions.length && isTickerLike(q) && q.length <= TICKER_MAX) {
		hits.unshift({ code: q, desc: 'Ficha del valor', kind: 'Valor', run: q });
	}
	return hits;
}
