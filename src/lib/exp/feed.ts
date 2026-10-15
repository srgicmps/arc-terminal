// Feed (experiencia /x/feed): todo lo que pasa como una línea de tiempo (titulares, temas de IMP, datos publicados,
// terremotos, movimientos de mercado y récords). Lógica pura: el +page.server.ts arma los sucesos y aquí se
// filtran por tema y por «solo lo mío» (tus valores de MIS, tus palabras vigiladas y tus países).
import { matches } from '../watchwords.ts';

export const TOPICS = [
	{ value: 'mundo', label: 'Mundo' },
	{ value: 'eco', label: 'Economía' },
	{ value: 'es', label: 'España' },
	{ value: 'mercados', label: 'Mercados' },
	{ value: 'tec', label: 'Tecnología' },
	{ value: 'datos', label: 'Datos' },
	{ value: 'avisos', label: 'Avisos' }
] as const;

export type Topic = (typeof TOPICS)[number]['value'];

/** Las secciones de titulares (NEWS_SECTIONS) en los temas del feed. */
export const SECTION_TOPIC: Record<string, Topic> = { geo: 'mundo', world: 'mundo', intl: 'mundo', eco: 'eco', es: 'es', gov: 'es', ws: 'mercados', tech: 'tec', ai: 'tec' };

export interface FeedItem {
	id: string;
	/** Cuándo (ISO 8601). */
	t: string;
	topic: Topic;
	kind: 'imp' | 'news' | 'release' | 'quake' | 'move' | 'record';
	title: string;
	titleEs?: string;
	lang?: 'en';
	url?: string;
	source: string;
	/** Una línea más (variación, magnitud…). */
	detail?: string;
	/** Vista de Arc donde seguir. */
	view?: string;
}

/** Del más reciente al más antiguo, sin repetir enlace (el primero gana: los de IMP van antes). */
export function mergeFeed(groups: FeedItem[][], limit = 150): FeedItem[] {
	const seen = new Set<string>();
	const out: FeedItem[] = [];
	for (const item of groups.flat()) {
		const key = item.url ?? item.id;
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(item);
	}
	return out.sort((a, b) => b.t.localeCompare(a.t)).slice(0, limit);
}

/** Lo que encaja con tus palabras (nombres de tus valores, palabras vigiladas, tus países). */
export const isMine = (item: Pick<FeedItem, 'title' | 'titleEs' | 'detail'>, words: string[]) =>
	words.length > 0 && matches(`${item.title} ${item.titleEs ?? ''} ${item.detail ?? ''}`, words).length > 0;

export function filterFeed(items: FeedItem[], topics: readonly string[], mineOnly: boolean, words: string[]): FeedItem[] {
	return items.filter((i) => (topics.length === 0 || topics.includes(i.topic)) && (!mineOnly || isMine(i, words)));
}

/** «Hoy», «Ayer» o la fecha, para separar los días (en hora de Madrid). */
export function dayLabel(iso: string, now: number): string {
	const fmt = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid' });
	const day = fmt.format(new Date(iso));
	if (day === fmt.format(new Date(now))) return 'Hoy';
	if (day === fmt.format(new Date(now - 86_400_000))) return 'Ayer';
	return new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(iso));
}
