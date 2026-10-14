// Tus medios (M23): los silenciados y el idioma original de los titulares, guardados en este navegador y
// comunes a todas las vistas (como un store de Pinia con persistencia). Se cambian en NEWS.
import type { NewsOrigin } from './newsprefs.ts';

export { visibleNews, type NewsOrigin } from './newsprefs.ts';

const KEY = 'arc-news-prefs';

export const newsPrefs = $state({ muted: [] as string[], origin: 'all' as NewsOrigin, ready: false });

/** Lee lo guardado. Solo en el navegador (desde un $effect); la segunda vez no hace nada. */
export function initNewsPrefs() {
	if (newsPrefs.ready) return;
	try {
		const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null');
		if (Array.isArray(saved?.muted)) newsPrefs.muted = saved.muted.filter((s: unknown) => typeof s === 'string');
		if (saved?.origin === 'es' || saved?.origin === 'en') newsPrefs.origin = saved.origin;
	} catch {}
	newsPrefs.ready = true;
}

function save() {
	try {
		localStorage.setItem(KEY, JSON.stringify({ muted: newsPrefs.muted, origin: newsPrefs.origin }));
	} catch {}
}

export function setMuted(muted: string[]) {
	newsPrefs.muted = [...new Set(muted)].sort((a, b) => a.localeCompare(b, 'es'));
	save();
}

export function setOrigin(origin: NewsOrigin) {
	newsPrefs.origin = origin;
	save();
}
