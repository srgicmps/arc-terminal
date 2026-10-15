// Búsqueda de la barra de comandos en el índice static/data/search.json (scripts/sources/search.ts).
// Lógica pura, sin Svelte, para probarla con Vitest. El índice se carga aparte, en diferido.
import { commandWithArg, findCommand, isTickerLike, norm, splitInput, symbolFunction, type Option } from './cmdline.ts';
import { LEADERS } from './leaders.ts';
import { plain } from './news.ts';
import type { SearchEntry } from './types.ts';

/** Una entrada lista para buscar: con su título ya normalizado (sin tildes y en mayúsculas). */
export interface Indexed extends SearchEntry {
	n: string;
}

/** Normaliza los títulos una sola vez, al cargar el índice. */
export function prepare(entries: SearchEntry[]): Indexed[] {
	return entries.filter((e) => e && typeof e.t === 'string' && typeof e.u === 'string').map((e) => ({ ...e, n: norm(e.t) }));
}

/** Texto sin tildes y en minúsculas, para los buscadores de las vistas (NEWS, BOE). */
export const fold = (s: string) => plain(s).toLowerCase();

/** Las palabras sueltas de lo escrito, ya sin tildes: «Banco  España» → ['banco', 'espana']. */
export const queryWords = (q: string) => fold(q).split(/\s+/).filter(Boolean);

/** ¿Están todas las palabras en el texto, en cualquier orden? Sin palabras, todo encaja. */
export const hasWords = (text: string, words: string[]) => {
	const t = fold(text);
	return words.every((w) => t.includes(w));
};

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
	if (!raw.trim()) return [];
	if (findCommand(raw) || commandWithArg(raw) || findCommand(splitInput(raw).head) || symbolFunction(raw)) return [];
	const hits = indexHits(raw, suggestions, index ?? [], limit);
	const text = raw.trim();
	if (norm(text).length < MIN_QUERY) return hits;
	// Un código corto sin nada más (AMZN): Intro sigue abriendo su ficha, no el archivo.
	const q = norm(raw);
	if (!hits.length && !suggestions.length && isTickerLike(q) && q.length <= TICKER_MAX) {
		hits.push({ code: q, desc: 'Ficha del valor', kind: 'Valor', run: q });
	}
	// Al final, buscar en el archivo de 3 meses (NEWS lo carga en diferido): la barra sigue ligera.
	hits.push({ code: 'NEWS', desc: `Buscar «${text}» en el archivo de 3 meses`, kind: 'Archivo', run: `NEWS ${text}` });
	return hits;
}

/** Titulares, BOE y valores del índice ligero que encajan con lo escrito. */
function indexHits(raw: string, suggestions: Option[], index: Indexed[], limit: number): Option[] {
	if (!index.length) return [];
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

/**
 * Los líderes de LIDER como opciones de la barra: «lagarde» o «trump» + Intro abren su ficha
 * (/lider?id=lagarde). El código es el id en mayúsculas, para que «LID» no los saque todos.
 */
export function leaderEntries(): Option[] {
	return LEADERS.map((l) => ({
		code: l.id.toUpperCase(),
		desc: `${l.name} · ${l.role}`,
		kind: 'Líder',
		aliases: [l.name, ...l.aliases],
		run: `LIDER ${l.id}`
	}));
}

// ---- Filtros de NEWS escritos en la búsqueda: «inflación /eco /7d» ----

/** Lo buscado en NEWS, separado en texto, sección y antigüedad máxima. */
export interface NewsQuery {
	text: string;
	/** Clave de la sección («eco»), o null si no se filtra. */
	section: string | null;
	/** Horas hacia atrás, o null si no se filtra. */
	hours: number | null;
}

/** «/24h», «/7d», «/2s» (semanas), «/3m» (meses). */
const HOURS_PER: Record<string, number> = { h: 1, d: 24, s: 24 * 7, m: 24 * 30 };

/**
 * Separa los filtros del texto: «/eco» o «/economia» (clave o principio del nombre de la sección) y
 * «/7d» (antigüedad). Un «/algo» que no es ningún filtro se queda en el texto. Si hay dos, gana el último.
 */
export function parseNewsQuery(raw: string, sections: readonly { key: string; label: string }[]): NewsQuery {
	const out: NewsQuery = { text: '', section: null, hours: null };
	const rest: string[] = [];
	for (const token of raw.split(/\s+/).filter(Boolean)) {
		const age = /^\/(\d{1,3})([hdsm])$/i.exec(token);
		const name = fold(token.slice(1));
		const section =
			token.startsWith('/') && name
				? (sections.find((s) => s.key === name) ?? (name.length >= 3 ? sections.find((s) => fold(s.label).startsWith(name)) : undefined))
				: undefined;
		if (age && Number(age[1]) > 0) out.hours = Number(age[1]) * HOURS_PER[age[2].toLowerCase()];
		else if (section) out.section = section.key;
		else rest.push(token);
	}
	out.text = rest.join(' ');
	return out;
}

/** ¿Es de las últimas `hours` horas? Sin filtro, todo vale; sin fecha, no. */
export function withinHours(time: string | null | undefined, hours: number | null, now = Date.now()): boolean {
	if (hours === null) return true;
	const t = time ? Date.parse(time) : NaN;
	return Number.isFinite(t) && now - t <= hours * 3_600_000;
}

/** Quita de lo buscado el filtro de sección («inflación /eco» → «inflación»), al elegir otra a mano. */
export function dropSectionFilter(raw: string, sections: readonly { key: string; label: string }[]): string {
	return raw
		.split(/\s+/)
		.filter((t) => !t || !t.startsWith('/') || parseNewsQuery(t, sections).section === null)
		.join(' ')
		.trim();
}
