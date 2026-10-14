// Lista de valores propia (comando MIS), guardada en este navegador. Funciona como un store de Pinia
// con persistencia en localStorage: si el navegador no deja guardar (modo privado…), sigue en memoria.

const KEY = 'arc-watchlist';

export const watchlist = $state({ codes: [] as string[], ready: false });

/** Se llama una vez al arrancar en el navegador (desde el layout). */
export function initWatchlist() {
	if (watchlist.ready) return;
	try {
		const saved = JSON.parse(localStorage.getItem(KEY) ?? '[]');
		if (Array.isArray(saved)) watchlist.codes = saved.filter((c) => typeof c === 'string');
	} catch {}
	watchlist.ready = true;
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
