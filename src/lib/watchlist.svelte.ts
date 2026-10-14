// Listas de valores propias (comando MIS), guardadas en este navegador. Funciona como un store de Pinia
// con persistencia en localStorage: si el navegador no deja guardar (modo privado…), sigue en memoria.
// `codes` es siempre la lista activa: la cinta, la barra, la ficha (☆) y «Mi mañana» solo miran esa.
import { addList, readLists, removeList, type WatchList } from './watchlists.ts';

const KEY = 'arc-watchlists';
/** La lista única de antes: solo se lee, para pasarla a la primera de las listas. */
const LEGACY_KEY = 'arc-watchlist';
/** «1» si la cinta de arriba enseña tu lista en vez de los índices de siempre. */
const TAPE_KEY = 'arc-tape';

export const watchlist = $state({ codes: [] as string[], ready: false, tape: false, lists: [] as WatchList[], active: 0 });

/** Se llama una vez al arrancar en el navegador (desde el layout). */
export function initWatchlist() {
	if (watchlist.ready) return;
	try {
		const { active, lists } = readLists(localStorage.getItem(KEY), localStorage.getItem(LEGACY_KEY));
		watchlist.lists = lists;
		watchlist.active = active;
		watchlist.codes = lists[active].codes;
		watchlist.tape = localStorage.getItem(TAPE_KEY) === '1';
	} catch {}
	watchlist.ready = true;
}

/** Cinta de arriba: tu lista (true) o los índices de siempre (false). */
export function setTape(on: boolean) {
	watchlist.tape = on;
	try {
		localStorage.setItem(TAPE_KEY, on ? '1' : '0');
	} catch {}
}

function save() {
	// La lista activa recoge los cambios de `codes` antes de guardar todas.
	if (!watchlist.lists.length) watchlist.lists = [{ name: 'Mi lista', codes: [] }];
	watchlist.lists[watchlist.active] = { ...watchlist.lists[watchlist.active], codes: watchlist.codes };
	try {
		localStorage.setItem(KEY, JSON.stringify({ active: watchlist.active, lists: watchlist.lists }));
	} catch {}
}

/** Enseña otra de tus listas. */
export function useList(index: number) {
	if (index < 0 || index >= watchlist.lists.length || index === watchlist.active) return;
	watchlist.active = index;
	watchlist.codes = watchlist.lists[index].codes;
	save();
}

/** Crea una lista vacía y la deja activa (si el nombre vale y no se repite). */
export function newList(name: string) {
	const next = addList({ active: watchlist.active, lists: watchlist.lists }, name);
	watchlist.lists = next.lists;
	useList(next.active);
}

/** Borra la lista activa (nunca la última). */
export function deleteList() {
	const next = removeList({ active: watchlist.active, lists: watchlist.lists }, watchlist.active);
	watchlist.lists = next.lists;
	watchlist.active = next.active;
	watchlist.codes = next.lists[next.active].codes;
	save();
}

export function inWatchlist(code: string): boolean {
	return watchlist.codes.includes(code.toUpperCase());
}

export function toggleWatch(code: string) {
	const c = code.trim().toUpperCase();
	if (!c) return;
	watchlist.codes = inWatchlist(c) ? watchlist.codes.filter((x) => x !== c) : [...watchlist.codes, c];
	save();
}

export function moveWatch(code: string, delta: -1 | 1) {
	const i = watchlist.codes.indexOf(code);
	const j = i + delta;
	if (i < 0 || j < 0 || j >= watchlist.codes.length) return;
	const next = [...watchlist.codes];
	[next[i], next[j]] = [next[j], next[i]];
	watchlist.codes = next;
	save();
}
