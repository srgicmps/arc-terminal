// GDELT: noticias de conflictos y tensiones internacionales que publican medios de todo el mundo.
// API DOC 2.0 (sin clave, uso libre citando a GDELT). Pide no hacer más de una consulta cada 5 s,
// así que se hace una sola consulta por actualización.
import type { NewsData, NewsItem } from '../../src/lib/types.ts';
import { list, plain, request, type Source } from '../lib.ts';

type Raw = Record<string, any>;

// Temas de GDELT (GKG) que encajan con geopolítica. Solo medios en español, últimas 24 h.
// Primero la consulta sencilla; si no trae nada, una más amplia.
const QUERIES = [
	'theme:ARMEDCONFLICT sourcelang:spanish',
	'(theme:ARMEDCONFLICT OR theme:MILITARY OR theme:SANCTIONS OR theme:CEASEFIRE) sourcelang:spanish'
];

const endpoint = (query: string) =>
	'https://api.gdeltproject.org/api/v2/doc/doc?' +
	new URLSearchParams({ query, mode: 'artlist', format: 'json', maxrecords: '75', timespan: '24h', sort: 'hybridrel' });

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Artículos de una consulta. Si GDELT no devuelve JSON (límite de uso, consulta mal hecha), avisa con su texto. */
async function articles(query: string): Promise<{ list: Raw[]; raw: string }> {
	// GDELT limita por IP y GitHub Actions comparte IP con otros repos: a veces responde 429
	// («demasiadas peticiones»). Se reintenta hasta 5 veces, esperando cada vez un poco más.
	const raw = await (await request(endpoint(query), {}, 5)).text();
	try {
		return { list: list<Raw>(JSON.parse(raw).articles), raw };
	} catch {
		throw new Error(`GDELT no ha devuelto JSON: ${plain(raw, 160)}`);
	}
}

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
		let result = await articles(QUERIES[0]);
		if (!result.list.length) {
			// GDELT pide al menos 5 s entre consultas.
			await wait(6_000);
			result = await articles(QUERIES[1]);
		}
		const seen = new Set<string>();
		const items: NewsItem[] = [];
		for (const a of result.list) {
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
		if (!items.length) throw new Error(`GDELT no ha devuelto noticias: ${plain(result.raw, 160)}`);
		return { items: items.slice(0, 30), feeds: [{ name: 'GDELT', count: items.length }] };
	}
};
