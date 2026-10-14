// Discursos de los banqueros centrales del mundo, que recoge el BIS (Banco de Pagos Internacionales).
// RSS 1.0: https://www.bis.org/doclist/cbspeeches.rss (comprobado con probe el 14-10-2026). Reutilización
// citando la fuente. Solo se guardan el título, el enlace, la fecha y el banco central.
import type { NewsData, NewsItem } from '../../src/lib/types.ts';
import { getText, type Source } from '../lib.ts';
import { parseFeed } from './news.ts';

const FEED = 'https://www.bis.org/doclist/cbspeeches.rss';
const MAX = 40;

/**
 * El banco central del orador, de la descripción del BIS: «Speech by Mr Andrew Bailey, Governor of the Bank of
 * England, at …» → «Bank of England». Si no se encuentra, «BIS».
 */
export function bankOf(summary: string): string {
	const m = /,\s*(?:[^,]*?\b(?:of|at)\s+)(?:the\s+)?((?:[A-Z][\w'’.-]*|of|the|and|de|du|des|do|da|del|y)(?:\s+(?:[A-Z][\w'’.-]*|of|the|and|de|du|des|do|da|del|y))*)\s*,/.exec(summary);
	const bank = m?.[1]?.trim().replace(/\s+(?:of|the|and|de|du|des|do|da|del|y)$/i, '');
	if (!bank || !/bank|reserve|banco|banque|bundesbank|monetary|authority|riksbank|norges|central/i.test(bank)) return 'BIS';
	return SHORT[bank] ?? bank;
}

/** Los más conocidos, con su nombre corto en español; el resto, tal como lo escribe el BIS. */
const SHORT: Record<string, string> = {
	'Board of Governors of the Federal Reserve System': 'Reserva Federal',
	'Federal Reserve System': 'Reserva Federal',
	'European Central Bank': 'BCE',
	'Bank of Spain': 'Banco de España',
	'Bank of England': 'Banco de Inglaterra',
	'Bank of Japan': 'Banco de Japón',
	'Deutsche Bundesbank': 'Bundesbank',
	'Bank of France': 'Banco de Francia',
	'Bank of Italy': 'Banco de Italia',
	"People's Bank of China": 'Banco Popular de China',
	'Swiss National Bank': 'Banco Nacional Suizo',
	'Bank of Canada': 'Banco de Canadá'
};

/** El discurso con su banco central como etiqueta y sin resumen (ECO no lo enseña). */
export function toSpeech(item: NewsItem): NewsItem {
	return { ...item, source: bankOf(item.summary), summary: '' };
}

export const speeches: Source<NewsData> = {
	name: 'speeches',
	label: 'Discursos de banqueros centrales · BIS',
	maxAgeMinutes: 175,
	async fetch() {
		const body = await getText(FEED, { headers: { Accept: 'application/rss+xml, application/xml' } });
		const items = parseFeed(body, 'BIS')
			.map(toSpeech)
			.sort((a, b) => (b.time ?? '').localeCompare(a.time ?? ''))
			.slice(0, MAX);
		// Con el principio del primer <item> en el error, para ver en el registro qué ha cambiado en el feed.
		if (!items.length) throw new Error(`sin discursos: ${body.match(/<item[\s>][\s\S]{0,600}/)?.[0].replace(/\s+/g, ' ') ?? body.slice(0, 300)}`);
		return { items, feeds: [{ name: 'BIS', ok: true, items: items.length }] };
	}
};
