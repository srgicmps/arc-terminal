// Bitácora (experiencia 10): tu diario de mercado. Notas por valor, país o tema con su fecha, ideas de
// inversión con precio de entrada que se siguen solas («desde que lo anotaste, +4 %») y recordatorios.
// Se guarda en la clave `arc-journal` (prefs.ts, tipo «dato»), así que con cuenta viaja a D1 como el resto
// de tus ajustes y nadie más la ve. Lógica pura, sin Svelte, para probarla con Vitest.

export const JOURNAL_KEY = 'arc-journal';
/** Topes: el valor de una clave en D1 no pasa de 64 KB (cloud/prefs.ts). 200 entradas de 400 letras caben. */
export const MAX_ENTRIES = 200;
export const MAX_TEXT = 400;

export type Kind = 'nota' | 'idea' | 'aviso';

export interface Entry {
	id: string;
	/** Cuándo la escribiste (ISO 8601). */
	at: string;
	kind: Kind;
	text: string;
	/** De qué va: un valor («NVDA»), una serie de G («US10»), un país («ES») o un tema libre («aranceles»). */
	about?: string;
	/** Ideas: precio cuando la anotaste y si apuestas a que sube (larga) o baja (corta). */
	price?: number;
	side?: 'larga' | 'corta';
	/** Recordatorios: el día (AAAA-MM-DD) y si ya está hecho. */
	due?: string;
	done?: boolean;
}

const KINDS: Kind[] = ['nota', 'idea', 'aviso'];
const DAY = /^\d{4}-\d{2}-\d{2}$/;

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** Una entrada guardada, comprobada; null si no vale. Lo de fuera (otro dispositivo, D1) puede venir mal. */
export function cleanEntry(raw: unknown): Entry | null {
	if (!raw || typeof raw !== 'object') return null;
	const r = raw as Record<string, unknown>;
	const id = str(r.id, 40);
	const text = str(r.text, MAX_TEXT);
	const kind = KINDS.includes(r.kind as Kind) ? (r.kind as Kind) : null;
	if (!id || !text || !kind || typeof r.at !== 'string' || Number.isNaN(Date.parse(r.at))) return null;
	const e: Entry = { id, at: r.at, kind, text };
	const about = str(r.about, 40);
	if (about) e.about = about;
	if (kind === 'idea' && typeof r.price === 'number' && Number.isFinite(r.price) && r.price > 0) {
		e.price = r.price;
		e.side = r.side === 'corta' ? 'corta' : 'larga';
	}
	if (kind === 'aviso' && typeof r.due === 'string' && DAY.test(r.due)) e.due = r.due;
	if (r.done === true) e.done = true;
	return e;
}

/** Lo guardado (texto JSON), limpio: sin repetidas, de la más nueva a la más antigua y con el tope. */
export function parseJournal(text: string | null): Entry[] {
	try {
		const raw: unknown = JSON.parse(text ?? '[]');
		if (!Array.isArray(raw)) return [];
		const seen = new Set<string>();
		const out: Entry[] = [];
		for (const r of raw) {
			const e = cleanEntry(r);
			if (e && !seen.has(e.id)) {
				seen.add(e.id);
				out.push(e);
			}
		}
		return sortEntries(out).slice(0, MAX_ENTRIES);
	} catch {
		return [];
	}
}

export const sortEntries = (list: Entry[]) => [...list].sort((a, b) => b.at.localeCompare(a.at));

/** Añade una entrada arriba. Si se pasa del tope, se va la más antigua (las ideas abiertas, las últimas). */
export function addEntry(list: Entry[], e: Entry): Entry[] {
	const next = sortEntries([e, ...list.filter((x) => x.id !== e.id)]);
	while (next.length > MAX_ENTRIES) {
		const i = next.findLastIndex((x) => x.kind !== 'idea' || x.done);
		next.splice(i < 0 ? next.length - 1 : i, 1);
	}
	return next;
}

export const removeEntry = (list: Entry[], id: string) => list.filter((e) => e.id !== id);

export const toggleDone = (list: Entry[], id: string) =>
	list.map((e) => (e.id === id ? (e.done ? { ...e, done: undefined } : { ...e, done: true }) : e));

/**
 * Cómo va una idea desde que la anotaste, en %: positivo si vas ganando (en una corta, ganar es que baje).
 * Null si no tiene precio o no hay precio de ahora.
 */
export function ideaReturn(e: Entry, now: number | null | undefined): number | null {
	if (e.kind !== 'idea' || !e.price || now == null || !Number.isFinite(now)) return null;
	const pct = ((now - e.price) / e.price) * 100;
	return e.side === 'corta' ? -pct : pct;
}

/**
 * Lo que se enseña de una idea: en % si es un precio y en puntos si la serie ya es un % (un bono a 10 años
 * que pasa del 4 al 4,2 % «sube 0,2 puntos», no un 5 %). Positivo si vas ganando.
 */
export function ideaMove(e: Entry, now: number | null | undefined, unit = ''): { value: number; unit: ' %' | ' pp' } | null {
	if (unit.trim() !== '%') {
		const pct = ideaReturn(e, now);
		return pct === null ? null : { value: pct, unit: ' %' };
	}
	if (e.kind !== 'idea' || e.price == null || now == null || !Number.isFinite(now)) return null;
	const pp = now - e.price;
	return { value: e.side === 'corta' ? -pp : pp, unit: ' pp' };
}

/** Recordatorios pendientes para hoy o atrasados (AAAA-MM-DD), del más antiguo al más nuevo. */
export function dueReminders(list: Entry[], today: string): Entry[] {
	return list.filter((e) => e.kind === 'aviso' && !e.done && e.due && e.due <= today).sort((a, b) => a.due!.localeCompare(b.due!));
}

/** Filtro de la lista: por tipo y por palabras en el texto o en «de qué va». */
export function filterEntries(list: Entry[], kind: Kind | 'todo', words: string[]): Entry[] {
	const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
	return list.filter(
		(e) => (kind === 'todo' || e.kind === kind) && words.every((w) => norm(`${e.text} ${e.about ?? ''}`).includes(norm(w)))
	);
}

/** Lo que se ha anotado de cada tema, de más a menos, para la lista de temas. */
export function topics(list: Entry[]): { about: string; n: number }[] {
	const count = new Map<string, number>();
	for (const e of list) if (e.about) count.set(e.about.toUpperCase(), (count.get(e.about.toUpperCase()) ?? 0) + 1);
	return [...count].map(([about, n]) => ({ about, n })).sort((a, b) => b.n - a.n || a.about.localeCompare(b.about));
}

/** Un id corto y suficiente para una persona: la hora en base 36 y un trozo al azar. */
export const newId = (now = Date.now(), rnd = Math.random()) => `${now.toString(36)}${Math.floor(rnd * 1296).toString(36).padStart(2, '0')}`;
