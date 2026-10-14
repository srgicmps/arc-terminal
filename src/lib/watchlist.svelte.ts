// Lista de valores propia (comando MIS), guardada en este navegador. Funciona como un store de Pinia
// con persistencia en localStorage: si el navegador no deja guardar (modo privado…), sigue en memoria.

const KEY = 'arc-watchlist';
/** «1» si la cinta de arriba enseña tu lista en vez de los índices de siempre. */
const TAPE_KEY = 'arc-tape';

export const watchlist = $state({ codes: [] as string[], ready: false, tape: false });

/** Se llama una vez al arrancar en el navegador (desde el layout). */
export function initWatchlist() {
	if (watchlist.ready) return;
	try {
		const saved = JSON.parse(localStorage.getItem(KEY) ?? '[]');
		if (Array.isArray(saved)) watchlist.codes = saved.filter((c) => typeof c === 'string');
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
	try {
		localStorage.setItem(KEY, JSON.stringify(watchlist.codes));
	} catch {}
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
