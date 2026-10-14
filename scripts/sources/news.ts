// Titulares por RSS. Solo se guardan el título, el enlace, la fecha y un resumen corto de cada noticia,
// siempre con su medio: para leerla entera hay que ir a la web original.
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { DIPLOMACY_FEEDS } from '../../src/lib/news.ts';
import type { FeedStatus, NewsData, NewsItem } from '../../src/lib/types.ts';
import { cluster } from '../cluster.ts';
import { getText, list, plain, type Source } from '../lib.ts';

interface Feed {
	name: string;
	url: string;
	/** Entradas que no se quieren, por su enlace (p. ej., los avisos de viaje del FCDO). */
	skip?: RegExp;
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
		{ name: 'Wired', url: 'https://www.wired.com/feed/rss' },
		// M38, comprobado con probe el 14-10-2026.
		{ name: 'NVIDIA', url: 'https://blogs.nvidia.com/feed/' }
	],
	ai: [
		{ name: 'MIT Technology Review', url: 'https://www.technologyreview.com/topic/artificial-intelligence/feed' },
		{ name: 'Hugging Face', url: 'https://huggingface.co/blog/feed.xml' },
		{ name: 'The Verge', url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml' },
		{ name: 'TechCrunch', url: 'https://techcrunch.com/category/artificial-intelligence/feed/' },
		{ name: 'OpenAI', url: 'https://openai.com/news/rss.xml' },
		{ name: 'Google', url: 'https://blog.google/technology/ai/rss/' },
		{ name: 'Simon Willison', url: 'https://simonwillison.net/atom/everything/' },
		// M38, comprobados con probe el 14-10-2026. Descartados: el blog de IA de Meta y las noticias de Anthropic (sin
		// RSS, 404); de Meta se usa su blog de ingeniería.
		{ name: 'Google DeepMind', url: 'https://deepmind.google/blog/rss.xml' },
		{ name: 'Meta', url: 'https://engineering.fb.com/feed/' },
		{ name: 'Microsoft Research', url: 'https://www.microsoft.com/en-us/research/feed/' }
	],
	gov: [
		{ name: 'La Moncloa', url: 'https://www.lamoncloa.gob.es/Paginas/rss.aspx?tipo=16' },
		{ name: 'Banco de España', url: 'https://www.bde.es/wbe/es/inicio/rss/rss-noticias/' },
		{ name: 'Comisión Europea', url: 'https://ec.europa.eu/commission/presscorner/api/rss?language=es' },
		{ name: 'Casa Blanca', url: 'https://www.whitehouse.gov/news/feed/' },
		{ name: 'Reserva Federal', url: 'https://www.federalreserve.gov/feeds/press_all.xml' }
	],
	// Organismos internacionales. Comprobados con probe (14-10-2026). Descartados: OTAN (sin RSS), FMI (429 desde
	// Actions), Banco Mundial (sin RSS, y su API de noticias va dos meses atrasada) y OPEP (403 de Cloudflare).
	intl: [
		// Comunicados y crónicas de las reuniones: Consejo de Seguridad, Asamblea General…
		{ name: 'ONU', url: 'https://press.un.org/en/rss.xml' },
		{ name: 'Noticias ONU', url: 'https://news.un.org/feed/subscribe/en/news/topic/peace-and-security/feed/rss.xml' },
		{ name: 'OMC', url: 'https://www.wto.org/library/rss/latest_news_e.xml' },
		// Diplomacia (M34, comprobados con probe el 14-10-2026). Descartados: Departamento de Estado (403 desde
		// Actions) y Servicio Europeo de Acción Exterior (sin RSS). Del FCDO se quitan los avisos de viaje.
		{
			name: DIPLOMACY_FEEDS[0],
			url: 'https://www.gov.uk/government/organisations/foreign-commonwealth-development-office.atom',
			skip: /\/foreign-travel-advice\//
		},
		{ name: DIPLOMACY_FEEDS[1], url: 'https://www.iaea.org/feeds/topnews' }
	]
};

/** Medios que publican en inglés: sus titulares llevan `lang: 'en'` para traducirlos (scripts/translate.ts). */
export const ENGLISH = new Set([
	'Financial Times',
	'BCE',
	'The Economist',
	'BBC',
	'Al Jazeera',
	'DW',
	'France 24',
	'The Guardian',
	'CNBC',
	'CNBC Markets',
	'MarketWatch',
	'WSJ',
	'Investing.com',
	'TechCrunch',
	'The Verge',
	'Ars Technica',
	'Wired',
	'MIT Technology Review',
	'Hugging Face',
	'OpenAI',
	'Google',
	'Simon Willison',
	'Casa Blanca',
	'Reserva Federal',
	'NVIDIA',
	'Google DeepMind',
	'Meta',
	'Microsoft Research',
	...DIPLOMACY_FEEDS
]);

/** Marca los titulares de un medio en inglés. */
export function withLang(items: NewsItem[], source: string): NewsItem[] {
	return ENGLISH.has(source) ? items.map((item) => ({ ...item, lang: 'en' as const })) : items;
}

/** Medios oficiales (gobiernos, bancos centrales): IMP los usa para confirmar noticias. */
export const OFFICIAL = new Set([...FEEDS.gov.map((f) => f.name), ...FEEDS.intl.map((f) => f.name), 'BCE']);

/** Cuántos titulares por medio y por sección como máximo. */
const PER_FEED = 15;
const PER_SECTION = 60;

const xml = new XMLParser({
	ignoreAttributes: false,
	attributeNamePrefix: '@',
	// Solo se quita el prefijo de los espacios de nombres que traen los campos que se leen (dc:date,
	// content:encoded, rdf:RDF…). Los demás se dejan: sin prefijo, <media:title> o <itunes:summary> se
	// juntarían con <title> y <summary> en una lista, y el titular se quedaría vacío (le pasaba a
	// Expansión, El Mundo y elDiario.es).
	transformTagName: (name) => name.replace(/^(dc|dcterms|content|rdf|atom):/, ''),
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

/**
 * Como parseFeed, pero si el canal no da ningún titular lanza un error que explica por qué:
 * el XML está roto o simplemente no trae noticias (p. ej., devuelve una página HTML).
 */
function readFeed(body: string, source: string): NewsItem[] {
	let items: NewsItem[];
	try {
		items = parseFeed(body, source);
	} catch {
		throw new Error('XML no válido');
	}
	if (items.length) return items;
	throw new Error(XMLValidator.validate(body) === true ? 'sin titulares' : 'XML no válido');
}

/**
 * Resumen corto y público del fallo de un canal: «HTTP 404», «tiempo agotado», «XML no válido»…
 * Nunca lleva la URL (podría llevar parámetros) ni el mensaje técnico entero.
 */
export function feedError(reason: unknown): string {
	const e = reason as { name?: string; message?: string } | undefined;
	const message = String(e?.message ?? reason ?? '');
	const http = message.match(/HTTP (\d{3})/);
	if (http) return `HTTP ${http[1]}`;
	if (e?.name === 'TimeoutError' || e?.name === 'AbortError' || /time ?out|timed out/i.test(message)) {
		return 'tiempo agotado';
	}
	if (message === 'XML no válido' || message === 'sin titulares') return message;
	if (/fetch failed|ENOTFOUND|ECONNREFUSED|ECONNRESET|EAI_AGAIN|certificate/i.test(message)) return 'sin conexión';
	return 'error';
}

async function section(feeds: Feed[]): Promise<NewsData> {
	const results = await Promise.allSettled(
		feeds.map(async (feed) =>
			withLang(
				readFeed(
					await getText(feed.url, {
						headers: { Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml' }
					}),
					feed.name
				)
					.filter((item) => !feed.skip?.test(item.url))
					.slice(0, PER_FEED),
				feed.name
			)
		)
	);
	const status: FeedStatus[] = [];
	const items: NewsItem[] = [];
	const seen = new Set<string>();
	results.forEach((r, i) => {
		const name = feeds[i].name;
		if (r.status === 'rejected') {
			// En el log de Actions va el error completo; en el JSON público, solo el resumen corto.
			console.log(`  rss · ${name} (${feeds[i].url}): ${r.reason?.message ?? r.reason}`);
			status.push({ name, ok: false, items: 0, error: feedError(r.reason) });
			return;
		}
		status.push({ name, ok: true, items: r.value.length });
		for (const item of r.value) {
			const key = item.title.toLowerCase();
			if (seen.has(key)) continue;
			seen.add(key);
			items.push(item);
		}
	});
	if (!items.length) throw new Error('ningún feed ha respondido');
	// Más recientes primero; las que no traen fecha, al final. Luego se juntan los titulares repetidos.
	items.sort((a, b) => (b.time ?? '').localeCompare(a.time ?? ''));
	return { items: cluster(items).slice(0, PER_SECTION), feeds: status };
}

const LABELS: Record<string, string> = {
	eco: 'Economía',
	geo: 'Geopolítica',
	es: 'España',
	ws: 'Wall Street',
	tech: 'Tecnología',
	ai: 'Inteligencia artificial',
	gov: 'Gobiernos e instituciones',
	intl: 'Organismos internacionales'
};

export const newsSources: Source<NewsData>[] = Object.entries(FEEDS).map(([key, feeds]) => ({
	name: `news-${key}`,
	label: `Titulares de ${LABELS[key]} · ${feeds.map((f) => f.name).join(', ')}`,
	maxAgeMinutes: 12,
	// Si se añade un canal, la copia guardada no lo tiene: se descarga de nuevo sin esperar.
	isStale: (previous) => feeds.some((f) => !previous.feeds?.some((s) => s.name === f.name)),
	fetch: () => section(feeds)
}));
