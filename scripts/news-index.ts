// «En las noticias»: para cada valor conocido, los titulares de todas las secciones que lo nombran.
// Se calcula al final de `pnpm data`, con los news-*.json ya escritos, y se guarda en
// static/data/news-index.json: así la ficha y MIS cargan unos pocos KB en vez de todos los titulares.
import { readFile } from 'node:fs/promises';
import { TICKERS } from '../src/lib/commands.ts';
import { COUNTRIES, countryTicker } from '../src/lib/countries.ts';
import type { Dataset } from '../src/lib/data.ts';
import { mentions, NEWS_SECTIONS, type Mention } from '../src/lib/news.ts';
import type { NewsData } from '../src/lib/types.ts';

/** Cuántos titulares por valor como mucho. */
const PER_TICKER = 12;
/** Y por país (PAIS): un país sale en más titulares que una empresa. */
const PER_COUNTRY = 20;

export type NewsIndex = Record<string, Mention[]>;
type Sections = { key: string; data: NewsData | null }[];

/** Los titulares de todas las secciones, sin repetir y del más reciente al más antiguo. Sin resumen, para que pese poco. */
function collect(sections: Sections): Mention[] {
	const seen = new Set<string>();
	const items: Mention[] = [];
	for (const { key, data } of sections) {
		for (const item of data?.items ?? []) {
			// La misma noticia puede estar en dos secciones (ECO y WS): se queda la primera.
			if (seen.has(item.url)) continue;
			seen.add(item.url);
			items.push({ ...item, summary: '', section: key });
		}
	}
	items.sort((a, b) => (b.time ?? '').localeCompare(a.time ?? ''));
	return items;
}

/** Para cada valor, los titulares que lo nombran. */
export function newsIndex(sections: Sections): NewsIndex {
	const items = collect(sections);
	const index: NewsIndex = {};
	for (const ticker of TICKERS) {
		const found = mentions(items, ticker).slice(0, PER_TICKER);
		if (found.length) index[ticker.code] = found;
	}
	return index;
}

/** Para cada país (código ISO: «DE»), los titulares que lo nombran por su nombre o su gentilicio. */
export function countryIndex(sections: Sections): NewsIndex {
	const items = collect(sections);
	const index: NewsIndex = {};
	for (const c of COUNTRIES) {
		const found = mentions(items, countryTicker(c)).slice(0, PER_COUNTRY);
		if (found.length) index[c.code] = found;
	}
	return index;
}

/** Lee los news-*.json de `dir`. */
async function readSections(dir: string): Promise<Sections> {
	return Promise.all(
		NEWS_SECTIONS.map(async ({ key }) => {
			try {
				const file = JSON.parse(await readFile(`${dir}/news-${key}.json`, 'utf8')) as Dataset<NewsData>;
				return { key, data: file.data };
			} catch {
				return { key, data: null };
			}
		})
	);
}

/** Los dos índices listos para guardar: news-index.json (valores) y news-countries.json (países). */
export async function buildNewsIndex(dir: string): Promise<[Dataset<NewsIndex>, Dataset<NewsIndex>]> {
	const sections = await readSections(dir);
	const fetchedAt = new Date().toISOString();
	return [
		{ name: 'news-index', fetchedAt, data: newsIndex(sections) },
		{ name: 'news-countries', fetchedAt, data: countryIndex(sections) }
	];
}
