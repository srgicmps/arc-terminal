// «En las noticias»: para cada valor conocido, los titulares de todas las secciones que lo nombran.
// Se calcula al final de `pnpm data`, con los news-*.json ya escritos, y se guarda en
// static/data/news-index.json: así la ficha y MIS cargan unos pocos KB en vez de todos los titulares.
import { readFile } from 'node:fs/promises';
import { TICKERS } from '../src/lib/commands.ts';
import type { Dataset } from '../src/lib/data.ts';
import { mentions, NEWS_SECTIONS, type Mention } from '../src/lib/news.ts';
import type { NewsData } from '../src/lib/types.ts';

/** Cuántos titulares por valor como mucho. */
const PER_TICKER = 12;

export type NewsIndex = Record<string, Mention[]>;

/** Junta los titulares de las secciones y busca cada valor. Sin resumen, para que pese poco. */
export function newsIndex(sections: { key: string; data: NewsData | null }[]): NewsIndex {
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
	const index: NewsIndex = {};
	for (const ticker of TICKERS) {
		const found = mentions(items, ticker).slice(0, PER_TICKER);
		if (found.length) index[ticker.code] = found;
	}
	return index;
}

/** Lee los news-*.json de `dir` y devuelve el índice listo para guardar. */
export async function buildNewsIndex(dir: string): Promise<Dataset<NewsIndex>> {
	const sections = await Promise.all(
		NEWS_SECTIONS.map(async ({ key }) => {
			try {
				const file = JSON.parse(await readFile(`${dir}/news-${key}.json`, 'utf8')) as Dataset<NewsData>;
				return { key, data: file.data };
			} catch {
				return { key, data: null };
			}
		})
	);
	return { name: 'news-index', fetchedAt: new Date().toISOString(), data: newsIndex(sections) };
}
