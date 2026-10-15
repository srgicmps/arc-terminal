// Vigilancia (Arc OS): tus objetivos y lo visto, en la clave arc-os-watch de prefs.ts (como un store de Pinia
// con persistencia). Al ser un «dato» de prefs.ts, cloud.svelte.ts la sube sola a tu cuenta y la lleva a tus
// otros dispositivos. La referencia de «lo nuevo» se fija al abrir la app y no se mueve mientras lees: solo
// cambia con «Marcar como visto» o en la próxima visita (como visit.svelte.ts con los titulares).
import { asset } from '$app/paths';
import type { ImpData, NewsData, Quake, Quote } from '../../../types.ts';
import { cleanTargets, keyOf, type Target } from './targets.ts';
import { mergeSeen, parseState, snapshot, type Assessment, type Feeds, type Snap } from './intel.ts';

export const WATCH_KEY = 'arc-os-watch';

export const watch = $state({
	targets: [] as Target[],
	/** Referencia de esta visita: lo visto y cuándo (null la primera vez). */
	ref: {} as Record<string, Snap>,
	refAt: null as string | null,
	ready: false
});

/** Lo guardado (puede ir por delante de la referencia: se apunta lo que ves). */
let stored = { at: null as string | null, seen: {} as Record<string, Snap> };

function write() {
	try {
		localStorage.setItem(WATCH_KEY, JSON.stringify({ targets: watch.targets, at: stored.at, seen: stored.seen }));
	} catch {
		// Sin sitio o en privado: sigue en memoria.
	}
}

/** Lee lo guardado. Desde un $effect (en el navegador); la segunda vez no hace nada. */
export function initWatch() {
	if (watch.ready) return;
	let raw: unknown = null;
	try {
		raw = JSON.parse(localStorage.getItem(WATCH_KEY) ?? 'null');
	} catch {}
	const s = parseState(raw, cleanTargets);
	watch.targets = s.targets;
	watch.ref = s.seen;
	watch.refAt = s.at;
	stored = { at: s.at, seen: s.seen };
	watch.ready = true;
}

export function setTargets(list: Target[]) {
	watch.targets = cleanTargets(list);
	const keys = new Set(watch.targets.map(keyOf));
	stored.seen = Object.fromEntries(Object.entries(stored.seen).filter(([k]) => keys.has(k)));
	write();
}

export const addTarget = (t: Target) => setTargets([...watch.targets, t]);
export const removeTarget = (t: Target) => setTargets(watch.targets.filter((x) => keyOf(x) !== keyOf(t)));

/** Apunta lo que se ve ahora como visto (para la próxima visita), sin mover la referencia de esta. */
export function recordSeen(list: Assessment[], now: number) {
	stored.seen = mergeSeen(stored.seen, snapshot(list), watch.targets.map(keyOf));
	stored.at = new Date(now).toISOString();
	write();
}

/** «Marcar como visto»: la referencia pasa a ser lo de ahora; lo nuevo deja de estar resaltado. */
export function markSeen(list: Assessment[], now: number) {
	recordSeen(list, now);
	watch.ref = stored.seen;
	watch.refAt = stored.at;
}

// ---------- Datos (/data/<nombre>.json, como widgetdata.svelte.ts) ----------

/** Secciones de titulares que se miran (las de NEWS con más volumen y variedad). */
const NEWS = ['news-geo', 'news-world', 'news-eco', 'news-ws', 'news-es', 'news-tech', 'news-ai', 'news-gov', 'news-intl'];

async function getJson<T>(name: string): Promise<T | null> {
	try {
		const r = await fetch(asset(`data/${name}.json` as Parameters<typeof asset>[0]), { cache: 'no-store' });
		return r.ok ? (((await r.json()) as { data: T }).data ?? null) : null;
	} catch {
		return null;
	}
}

export async function loadFeeds(): Promise<Feeds> {
	const [imp, quakes, quotes, ...news] = await Promise.all([
		getJson<ImpData>('imp'),
		getJson<Quake[]>('quakes'),
		getJson<Quote[]>('alert-quotes'),
		...NEWS.map((n) => getJson<NewsData>(n))
	]);
	return {
		imp,
		quakes: Array.isArray(quakes) ? quakes : [],
		quotes: Array.isArray(quotes) ? quotes : [],
		news: news.filter((n): n is NewsData => !!n && Array.isArray(n.items))
	};
}
