// Titulares por RSS. Solo se guardan el título, el enlace, la fecha y un resumen corto de cada noticia,
// siempre con su medio: para leerla entera hay que ir a la web original.
import { XMLParser } from 'fast-xml-parser';
import type { FeedStatus, NewsData, NewsItem } from '../../src/lib/types.ts';
import { getText, list, plain, type Source } from '../lib.ts';

interface Feed {
	name: string;
	url: string;
}

const FEEDS: Record<string, Feed[]> = {
	eco: [
		{ name: 'El País', url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/economia/portada' },
		{ name: 'Expansión', url: 'https://e00-expansion.uecdn.es/rss/economia.xml' },
		{ name: 'El Confidencial', url: 'https://rss.elconfidencial.com/economia/' },
		{ name: 'Financial Times', url: 'https://www.ft.com/global-economy?format=rss' },
		{ name: 'BCE', url: 'https://www.ecb.europa.eu/rss/press.html' },
		{ name: 'The Economist', url: 'https://www.economist.com/finance-and-economics/rss.xml' }
	],
	geo: [
		{ name: 'BBC', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
		{ name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
		{ name: 'DW', url: 'https://rss.dw.com/xml/rss-en-world' },
		{ name: 'France 24', url: 'https://www.france24.com/en/rss' },
		{ name: 'The Guardian', url: 'https://www.theguardian.com/world/rss' },
		{ name: 'El País', url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/internacional/portada' }
	],
	es: [
		{ name: 'El País', url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada' },
		{ name: 'RTVE', url: 'https://api2.rtve.es/rss/temas_noticias.xml' },
		{ name: 'elDiario.es', url: 'https://www.eldiario.es/rss/' },
		{ name: 'El Mundo', url: 'https://e00-elmundo.uecdn.es/elmundo/rss/espana.xml' },
		{ name: 'Europa Press', url: 'https://www.europapress.es/rss/rss.aspx' },
		{ name: 'IB3', url: 'https://ib3.org/feed' }
	],
	ws: [
		{ name: 'CNBC', url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114' },
		{ name: 'CNBC Markets', url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=20910258' },
		{ name: 'MarketWatch', url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories' },
		{ name: 'WSJ', url: 'https://feeds.content.dowjones.io/public/rss/RSSMarketsMain' },
		{ name: 'Investing.com', url: 'https://www.investing.com/rss/news_25.rss' }
	],
	tech: [
		{ name: 'TechCrunch', url: 'https://techcrunch.com/feed/' },
		{ name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml' },
		{ name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index' },
		{ name: 'Xataka', url: 'https://www.xataka.com/index.xml' },
		{ name: 'Wired', url: 'https://www.wired.com/feed/rss' }
	],
	ai: [
		{ name: 'MIT Technology Review', url: 'https://www.technologyreview.com/topic/artificial-intelligence/feed' },
		{ name: 'Hugging Face', url: 'https://huggingface.co/blog/feed.xml' },
		{ name: 'The Verge', url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml' },
		{ name: 'TechCrunch', url: 'https://techcrunch.com/category/artificial-intelligence/feed/' },
		{ name: 'OpenAI', url: 'https://openai.com/news/rss.xml' },
		{ name: 'Google', url: 'https://blog.google/technology/ai/rss/' },
		{ name: 'Simon Willison', url: 'https://simonwillison.net/atom/everything/' }
	],
	gov: [
		{ name: 'La Moncloa', url: 'https://www.lamoncloa.gob.es/Paginas/rss.aspx?tipo=16' },
		{ name: 'Banco de España', url: 'https://www.bde.es/wbe/es/inicio/rss/rss-noticias/' },
		{ name: 'Comisión Europea', url: 'https://ec.europa.eu/commission/presscorner/api/rss?language=es' },
		{ name: 'Parlamento Europeo', url: 'https://www.europarl.europa.eu/rss/doc/top-stories/es.xml' },
		{ name: 'Casa Blanca', url: 'https://www.whitehouse.gov/news/feed/' },
		{ name: 'Reserva Federal', url: 'https://www.federalreserve.gov/feeds/press_all.xml' }
	]
};

/** Cuántos titulares por medio y por sección como máximo. */
const PER_FEED = 15;
const PER_SECTION = 60;

const xml = new XMLParser({
	ignoreAttributes: false,
	attributeNamePrefix: '@',
	removeNSPrefix: true,
	parseTagValue: false,
	textNodeName: '#text'
});

type Raw = Record<string, any>;

function text(value: unknown): string {
	if (value === null || value === undefined) return '';
	if (typeof value === 'object') return text((value as Raw)['#text'] ?? '');
	return String(value);
}

/** Atom guarda el enlace en un atributo y a veces hay varios: se prefiere el «alternate». */
function link(entry: Raw): string {
	const links = list<Raw | string>(entry.link);
	for (const l of links) {
		if (typeof l === 'string' && l.trim()) return l.trim();
		if (l && typeof l === 'object') {
			const rel = (l as Raw)['@rel'];
			if ((!rel || rel === 'alternate') && (l as Raw)['@href']) return String((l as Raw)['@href']);
			if ((l as Raw)['#text']) return String((l as Raw)['#text']).trim();
		}
	}
	const guid = text(entry.guid);
	return guid.startsWith('http') ? guid : '';
}

function date(entry: Raw): string | null {
	const raw = text(entry.pubDate ?? entry.published ?? entry.updated ?? entry.date ?? entry.issued);
	const t = Date.parse(raw);
	return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

export function parseFeed(body: string, source: string): NewsItem[] {
	const doc = xml.parse(body);
	const entries = list<Raw>(doc?.rss?.channel?.item ?? doc?.feed?.entry ?? doc?.RDF?.item ?? doc?.channel?.item);
	return entries
		.map((entry) => ({
			title: plain(text(entry.title), 300),
			url: link(entry),
			source,
			time: date(entry),
			summary: plain(text(entry.description ?? entry.summary ?? entry.content ?? entry.encoded), 280)
		}))
		.filter((item) => item.title && item.url.startsWith('http'));
}

async function section(feeds: Feed[]): Promise<NewsData> {
	const results = await Promise.allSettled(
		feeds.map(async (feed) =>
			parseFeed(
				await getText(feed.url, {
					headers: { Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml' }
				}),
				feed.name
			).slice(0, PER_FEED)
		)
	);
	const status: FeedStatus[] = [];
	const items: NewsItem[] = [];
	const seen = new Set<string>();
	results.forEach((r, i) => {
		const name = feeds[i].name;
		if (r.status === 'rejected') {
			const error = String(r.reason?.message ?? r.reason);
			console.log(`  rss · ${name} (${feeds[i].url}): ${error}`);
			status.push({ name, count: 0, error });
			return;
		}
		status.push({ name, count: r.value.length });
		for (const item of r.value) {
			const key = item.title.toLowerCase();
			if (seen.has(key)) continue;
			seen.add(key);
			items.push(item);
		}
	});
	if (!items.length) throw new Error('ningún feed ha respondido');
	// Más recientes primero; las que no traen fecha, al final.
	items.sort((a, b) => (b.time ?? '').localeCompare(a.time ?? ''));
	return { items: items.slice(0, PER_SECTION), feeds: status };
}

const LABELS: Record<string, string> = {
	eco: 'Economía',
	geo: 'Geopolítica',
	es: 'España',
	ws: 'Wall Street',
	tech: 'Tecnología',
	ai: 'Inteligencia artificial',
	gov: 'Gobiernos e instituciones'
};

export const newsSources: Source<NewsData>[] = Object.entries(FEEDS).map(([key, feeds]) => ({
	name: `news-${key}`,
	label: `Titulares de ${LABELS[key]} · ${feeds.map((f) => f.name).join(', ')}`,
	maxAgeMinutes: 25,
	fetch: () => section(feeds)
}));
