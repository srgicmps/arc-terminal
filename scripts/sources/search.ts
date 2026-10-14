// SEARCH: índice ligero para que la barra de comandos también busque (como Ctrl+K). Fuente derivada
// (`after`): no descarga nada, junta lo que las demás fuentes acaban de dejar en esta pasada:
//   - titulares de todas las secciones news-* de los últimos 2 días (etiqueta NEWS), sin repetir enlace;
//   - disposiciones del BOE del día (etiqueta BOE);
//   - los valores conocidos de src/lib/commands.ts (etiqueta Valor), que enlazan a su ficha /s?sym=….
// La web lo carga solo la primera vez que se enfoca la barra, así que tiene que pesar poco.
import { TICKERS } from '../../src/lib/commands.ts';
import { NEWS_SECTIONS } from '../../src/lib/news.ts';
import type { BoeData, NewsData, NewsItem, SearchEntry } from '../../src/lib/types.ts';
import { NO_CONTEXT, type Source } from '../lib.ts';
import { normUrl } from './imp.ts';

const HOUR = 3_600_000;
/** Titulares más antiguos que esto no entran en el índice. */
export const MAX_AGE_HOURS = 48;
/** Títulos más largos que esto se recortan (los del BOE pasan a menudo de 300 caracteres). */
export const MAX_TITLE = 140;
/** Tamaño máximo del índice en bytes (JSON en UTF-8). */
export const MAX_BYTES = 150_000;

/** Recorta un título a `max` caracteres, por un espacio si puede, con «…» al final. */
export function clip(text: string, max = MAX_TITLE): string {
	const t = text.replace(/\s+/g, ' ').trim();
	if (t.length <= max) return t;
	const cut = t.slice(0, max - 1);
	const space = cut.lastIndexOf(' ');
	return (space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;:–—-]+$/, '') + '…';
}

/** Titulares recientes de todas las secciones, del más nuevo al más antiguo y sin repetir enlace. */
export function newsEntries(sections: NewsItem[][], now: number): SearchEntry[] {
	const seen = new Set<string>();
	const out: SearchEntry[] = [];
	const items = sections
		.flat()
		.filter((i) => {
			const t = i.time ? Date.parse(i.time) : NaN;
			return i.title && i.url && Number.isFinite(t) && now - t <= MAX_AGE_HOURS * HOUR;
		})
		.sort((a, b) => (b.time ?? '').localeCompare(a.time ?? ''));
	for (const item of items) {
		const key = normUrl(item.url);
		if (seen.has(key)) continue;
		seen.add(key);
		// La misma noticia en otros medios (`also`) ya está agrupada: sus enlaces tampoco se repiten.
		for (const a of item.also ?? []) seen.add(normUrl(a.url));
		out.push({ t: clip(item.title), u: item.url, s: 'NEWS' });
	}
	return out;
}

/** Disposiciones del BOE: primero las secciones I–III; los anuncios (IV y V), al final. */
export function boeEntries(boe: BoeData | undefined): { main: SearchEntry[]; rest: SearchEntry[] } {
	const main: SearchEntry[] = [];
	const rest: SearchEntry[] = [];
	for (const section of boe?.sections ?? []) {
		const target = /^(4|5)/.test(section.code) ? rest : main;
		for (const item of section.items) {
			const u = item.html || item.pdf;
			if (item.title && u) target.push({ t: clip(item.title), u, s: 'BOE' });
		}
	}
	return { main, rest };
}

export function tickerEntries(): SearchEntry[] {
	return TICKERS.map((t) => ({ t: `${t.code} · ${t.name}`, u: `/s?sym=${encodeURIComponent(t.code)}`, s: 'Valor' }));
}

/** Bytes que ocupa una entrada dentro de la lista JSON (más la coma). */
const size = (e: SearchEntry) => Buffer.byteLength(JSON.stringify(e)) + 1;

/**
 * Junta las entradas por orden de prioridad y se para al llegar a `maxBytes`: valores, BOE (I–III),
 * titulares del más nuevo al más antiguo y, si queda sitio, los anuncios del BOE.
 */
export function buildIndex(groups: SearchEntry[][], maxBytes = MAX_BYTES): SearchEntry[] {
	const out: SearchEntry[] = [];
	let bytes = 2; // «[]»
	for (const group of groups) {
		for (const entry of group) {
			const n = size(entry);
			if (bytes + n > maxBytes) return out;
			bytes += n;
			out.push(entry);
		}
	}
	return out;
}

export const search: Source<SearchEntry[]> = {
	name: 'search',
	label: 'Índice de la barra de comandos · titulares, BOE y valores de esta misma actualización',
	maxAgeMinutes: 12,
	after: true,
	async fetch(_previous, ctx = NO_CONTEXT) {
		const sections = NEWS_SECTIONS.map((s) => ctx.get<NewsData>(`news-${s.key}`)?.items ?? []);
		const boe = boeEntries(ctx.get<BoeData>('boe'));
		const news = newsEntries(sections, Date.now());
		if (!news.length && !boe.main.length) throw new Error('sin titulares ni BOE con los que hacer el índice');
		return buildIndex([tickerEntries(), boe.main, news, boe.rest]);
	}
};
