// Wikipedia en español y en inglés: lo más leído ayer, efemérides, artículo destacado y, en inglés,
// «In the news». API de Wikimedia (sin clave, pide identificarse con User-Agent). Textos CC BY-SA 4.0.
import type { WikiData, WikiEdition, WikiPage } from '../../src/lib/types.ts';
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

const firstUrl = (pages: Raw[] | undefined) => String(list<Raw>(pages)[0]?.content_urls?.desktop?.page ?? '');

// Páginas que no son artículos (portada, búsqueda, especiales), en los dos idiomas.
const SKIP = /^(Wikipedia:|Especial:|Special:|Portal:|Portada|Main_Page)/;

/** Lo del día en una Wikipedia (`lang`: es, en). */
export async function edition(lang: 'es' | 'en', day: string): Promise<WikiEdition> {
	const body = await getJson<Raw>(`https://api.wikimedia.org/feed/v1/wikipedia/${lang}/featured/${day.replaceAll('-', '/')}`);
	const mostRead = list<Raw>(body.mostread?.articles)
		.filter((a) => !SKIP.test(String(a.title)))
		.slice(0, 25)
		.map(page)
		.filter((p): p is WikiPage => p !== null && Boolean(p.url));
	const onThisDay = list<Raw>(body.onthisday)
		.map((e) => ({ year: Number(e.year), text: plain(e.text, 300), url: firstUrl(e.pages) }))
		.filter((e) => e.text)
		.sort((a, b) => b.year - a.year);
	if (!mostRead.length && !onThisDay.length) throw new Error(`feed de Wikipedia (${lang}) vacío`);
	const result: WikiEdition = { featured: page(body.tfa), mostRead, onThisDay };
	const news = list<Raw>(body.news)
		.map((n) => ({ text: plain(n.story, 600), url: firstUrl(n.links) }))
		.filter((n) => n.text);
	if (news.length) result.news = news;
	return result;
}

export const wiki: Source<WikiData> = {
	name: 'wiki',
	label: 'Lo más leído y efemérides · Wikipedia en español y en inglés',
	maxAgeMinutes: 175,
	async fetch() {
		const date = madridDay();
		const es = await edition('es', date);
		// El inglés es un extra: si falla, WIKI sigue con el español.
		const en = await edition('en', date).catch((error) => {
			console.log(`  wiki · en: ${error instanceof Error ? error.message : error}`);
			return undefined;
		});
		return en ? { date, ...es, en } : { date, ...es };
	}
};
