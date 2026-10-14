// Wikipedia en español: lo más leído ayer, efemérides y artículo destacado.
// API de Wikimedia (sin clave, pide identificarse con User-Agent). Textos CC BY-SA 4.0.
import type { WikiData, WikiPage } from '../../src/lib/types.ts';
import { getJson, list, madridDay, plain, type Source } from '../lib.ts';

type Raw = Record<string, any>;

function page(raw: Raw | undefined): WikiPage | null {
	if (!raw) return null;
	return {
		title: plain(raw.normalizedtitle ?? raw.titles?.normalized ?? raw.title),
		url: String(raw.content_urls?.desktop?.page ?? ''),
		extract: plain(raw.extract, 320),
		views: typeof raw.views === 'number' ? raw.views : undefined
	};
}

// Páginas que no son artículos (portada, búsqueda, especiales).
const SKIP = /^(Wikipedia:|Especial:|Portada|Main_Page)/;

export const wiki: Source<WikiData> = {
	name: 'wiki',
	label: 'Lo más leído y efemérides · Wikipedia en español',
	maxAgeMinutes: 175,
	async fetch() {
		const day = madridDay();
		const body = await getJson<Raw>(
			`https://api.wikimedia.org/feed/v1/wikipedia/es/featured/${day.replaceAll('-', '/')}`
		);
		const mostRead = list<Raw>(body.mostread?.articles)
			.filter((a) => !SKIP.test(String(a.title)))
			.slice(0, 25)
			.map(page)
			.filter((p): p is WikiPage => p !== null && Boolean(p.url));
		const onThisDay = list<Raw>(body.onthisday)
			.map((e) => ({
				year: Number(e.year),
				text: plain(e.text, 300),
				url: String(list<Raw>(e.pages)[0]?.content_urls?.desktop?.page ?? '')
			}))
			.filter((e) => e.text)
			.sort((a, b) => b.year - a.year);
		if (!mostRead.length && !onThisDay.length) throw new Error('feed de Wikipedia vacío');
		return { date: day, featured: page(body.tfa), mostRead, onThisDay };
	}
};
