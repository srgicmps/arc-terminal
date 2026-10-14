// GDELT: noticias de conflictos y tensiones internacionales que publican medios de todo el mundo.
// API DOC 2.0 (sin clave, uso libre citando a GDELT). Pide no hacer más de una consulta cada 5 s,
// así que se hace una sola consulta por actualización.
import type { NewsData, NewsItem } from '../../src/lib/types.ts';
import { getJson, list, plain, type Source } from '../lib.ts';

type Raw = Record<string, any>;

// Temas de GDELT (GKG) que encajan con geopolítica. Solo medios en español, últimas 24 h.
const QUERY = '(theme:ARMEDCONFLICT OR theme:MILITARY OR theme:SANCTIONS OR theme:CEASEFIRE) sourcelang:spanish';

const ENDPOINT =
	'https://api.gdeltproject.org/api/v2/doc/doc?' +
	new URLSearchParams({
		query: QUERY,
		mode: 'artlist',
		format: 'json',
		maxrecords: '75',
		timespan: '24h',
		sort: 'hybridrel'
	});

/** «20261014T113000Z» → ISO 8601. */
function seenDate(value: unknown): string | null {
	const m = String(value ?? '').match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
	return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z` : null;
}

export const gdelt: Source<NewsData> = {
	name: 'gdelt',
	label: 'Conflictos en medios de todo el mundo · GDELT',
	maxAgeMinutes: 55,
	async fetch() {
		// Si la consulta no le gusta, GDELT responde con un texto en vez de JSON: getJson falla y se avisa.
		const body = await getJson<Raw>(ENDPOINT);
		const seen = new Set<string>();
		const items: NewsItem[] = [];
		for (const a of list<Raw>(body.articles)) {
			const title = plain(a.title, 200);
			// El mismo teletipo sale en muchos medios: se queda solo el primero.
			const key = title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
			if (!title || !a.url || seen.has(key)) continue;
			seen.add(key);
			const country = plain(a.sourcecountry, 40);
			items.push({
				title,
				url: String(a.url),
				source: country ? `${a.domain} · ${country}` : String(a.domain ?? ''),
				time: seenDate(a.seendate),
				summary: ''
			});
		}
		if (!items.length) throw new Error('GDELT no ha devuelto noticias');
		return { items: items.slice(0, 30), feeds: [{ name: 'GDELT', count: items.length }] };
	}
};
