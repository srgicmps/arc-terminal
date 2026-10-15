// Varias listas de valores en MIS (parte sin Svelte, con tests). Se guardan juntas en «arc-watchlists» como
// { active, lists: [{ name, codes }] }. Si aún no existe, la lista de siempre («arc-watchlist», solo códigos)
// pasa a ser la primera, «Mi lista»: nadie pierde nada al actualizar.

export interface WatchList {
	name: string;
	codes: string[];
}

export interface WatchLists {
	/** Posición de la lista que se enseña y que usan la cinta, la barra y la ficha (☆). */
	active: number;
	lists: WatchList[];
}

export const FIRST_NAME = 'Mi lista';
/** Hasta cuántas listas: suficientes para separar por temas sin llenar el selector. */
export const MAX_LISTS = 8;

/** Un código válido: «NVDA», «BRK.B», «BME:REP» (la misma regla que CARTERA). */
export const CODE = /^[A-Z0-9][A-Z0-9.\-:]{0,19}$/;

/** Lo escrito en MIS («nvda, aapl bme:rep») → códigos válidos sin repetir y lo que no lo es. */
export function splitCodes(text: string): { codes: string[]; bad: string[] } {
	const words = text.toUpperCase().split(/[\s,;]+/).filter(Boolean);
	return { codes: [...new Set(words.filter((w) => CODE.test(w)))], bad: words.filter((w) => !CODE.test(w)) };
}

/** Códigos guardados (localStorage, la nube o un archivo importado): en mayúsculas, válidos y sin repetir. */
const codesOf = (v: unknown): string[] =>
	Array.isArray(v) ? [...new Set(v.filter((c): c is string => typeof c === 'string').map((c) => c.trim().toUpperCase()))].filter((c) => CODE.test(c)) : [];

/** Lo guardado (texto de localStorage) → listas válidas, siempre con al menos una. */
export function readLists(current: string | null, legacy: string | null): WatchLists {
	try {
		const saved = JSON.parse(current ?? 'null');
		const lists = (Array.isArray(saved?.lists) ? saved.lists : [])
			.filter((l: unknown) => l && typeof (l as WatchList).name === 'string')
			.map((l: WatchList) => ({ name: l.name.trim() || FIRST_NAME, codes: codesOf(l.codes) }))
			.slice(0, MAX_LISTS);
		if (lists.length) {
			const active = Number.isInteger(saved.active) && saved.active >= 0 && saved.active < lists.length ? saved.active : 0;
			return { active, lists };
		}
	} catch {}
	let codes: string[] = [];
	try {
		codes = codesOf(JSON.parse(legacy ?? '[]'));
	} catch {}
	return { active: 0, lists: [{ name: FIRST_NAME, codes }] };
}

/** Añade una lista vacía con ese nombre y la deja activa. Sin nombre, repetido o con el tope lleno: igual. */
export function addList(state: WatchLists, name: string): WatchLists {
	const clean = name.trim().slice(0, 30);
	if (!clean || state.lists.length >= MAX_LISTS || state.lists.some((l) => l.name.toLowerCase() === clean.toLowerCase())) {
		return state;
	}
	return { active: state.lists.length, lists: [...state.lists, { name: clean, codes: [] }] };
}

/** Quita una lista (nunca la última) y deja activa la de al lado. */
export function removeList(state: WatchLists, index: number): WatchLists {
	if (state.lists.length <= 1 || index < 0 || index >= state.lists.length) return state;
	const lists = state.lists.filter((_, i) => i !== index);
	return { active: Math.min(index, lists.length - 1), lists };
}
