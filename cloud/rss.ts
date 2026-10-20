// «Mis RSS» (vista RSS): cada usuario guarda sus feeds y una Pages Function los lee por él. /api/rss.
// - Solo personas con cuenta (JWT de Access con email); los tokens de servicio, no.
// - GET: su lista. PUT { feeds }: guardarla (con tope). DELETE: borrarla. GET ?items=1: los titulares.
// - Hace de proxy de RSS, así que va con topes: 20 feeds, 1 MB por feed, 8 s, 3 redirecciones, solo
//   http(s) a nombres públicos (nada de IP, localhost ni puertos raros), y caché de 15 min por feed.
// - Solo devuelve titulares, enlaces http(s) y fechas: nunca HTML del feed.
import { person } from './access.ts';
import { json, type D1Database, type Env } from './prefs.ts';
import { ensure } from './schema.ts';

export const RSS_LIMITS = {
	feeds: 20,
	url: 500,
	body: 4_000,
	bytes: 1_000_000,
	timeout: 8_000,
	redirects: 3,
	perFeed: 30,
	items: 200,
	title: 300,
	link: 1_000,
	ttl: 15 * 60 * 1000,
	cache: 300
};

export interface FeedItem {
	feed: string;
	title: string;
	link: string;
	/** Milisegundos, o null si el feed no trae fecha. */
	at: number | null;
}
export interface FeedStatus {
	url: string;
	title: string;
	ok: boolean;
}

export interface RssStore {
	get(user: string): Promise<string[]>;
	put(user: string, feeds: string[]): Promise<void>;
	remove(user: string): Promise<void>;
}

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

/** La URL normalizada si se puede leer, o null: http(s), sin usuario, sin IP, sin puerto raro, con dominio. */
export function feedUrl(raw: unknown): string | null {
	if (typeof raw !== 'string' || raw.length > RSS_LIMITS.url) return null;
	let u: URL;
	try {
		u = new URL(raw.trim());
	} catch {
		return null;
	}
	if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
	if (u.username || u.password || u.port) return null;
	const host = u.hostname.toLowerCase();
	if (!host.includes('.') || host.startsWith('[') || /^[\d.]+$/.test(host) || /^[0-9a-f:]+$/.test(host)) return null;
	if (/(^|\.)(localhost|local|internal|lan|home|arpa)$/.test(host)) return null;
	u.hash = '';
	return u.href;
}

/** La lista de un PUT, limpia: URLs válidas, sin repetir y con tope. Un texto si no vale. */
export function parseFeeds(body: unknown): string[] | string {
	const list = (body as { feeds?: unknown })?.feeds;
	if (!Array.isArray(list)) return 'falta feeds';
	if (list.length > RSS_LIMITS.feeds) return `máximo ${RSS_LIMITS.feeds}`;
	const out: string[] = [];
	for (const raw of list) {
		const url = feedUrl(raw);
		if (!url) return 'URL no válida';
		if (!out.includes(url)) out.push(url);
	}
	return out;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decode = (s: string) =>
	s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
		if (e[0] === '#') {
			const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
			return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : '';
		}
		return ENTITIES[e.toLowerCase()] ?? m;
	});

/** Texto plano de un nodo: sin CDATA, sin etiquetas, sin entidades y en una línea. */
function text(raw: string | undefined, max: number): string {
	if (!raw) return '';
	const s = raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
	// Dos pasadas: las etiquetas pueden venir escapadas (&lt;b&gt;) dentro del texto.
	const plain = decode(decode(s.replace(/<[^>]*>/g, ' ')).replace(/<[^>]*>/g, ' '));
	return plain.replace(/\s+/g, ' ').trim().slice(0, max);
}

const tag = (xml: string, name: string) =>
	new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i').exec(xml)?.[1];

/** Solo enlaces http(s): nunca javascript:, data: ni relativos raros. */
function safeLink(raw: string, base: string): string {
	try {
		const u = new URL(decode(raw.trim()), base);
		return (u.protocol === 'https:' || u.protocol === 'http:') && u.href.length <= RSS_LIMITS.link ? u.href : '';
	} catch {
		return '';
	}
}

function linkOf(block: string, base: string): string {
	// Atom: <link href="…" rel="alternate"/> (o sin rel). RSS: <link>…</link>.
	const atoms = [...block.matchAll(/<link\b([^>]*?)\/?>/gi)].map((m) => m[1]);
	const attr = (a: string, n: string) => new RegExp(`\\b${n}\\s*=\\s*["']([^"']*)["']`, 'i').exec(a)?.[1];
	const alt = atoms.find((a) => attr(a, 'href') && (!attr(a, 'rel') || attr(a, 'rel') === 'alternate'));
	if (alt) return safeLink(attr(alt, 'href')!, base);
	const rss = tag(block, 'link');
	if (rss) return safeLink(text(rss, RSS_LIMITS.link), base);
	const guid = /<guid\b(?![^>]*isPermaLink\s*=\s*["']false)[^>]*>([\s\S]*?)<\/guid>/i.exec(block)?.[1];
	return guid ? safeLink(text(guid, RSS_LIMITS.link), base) : '';
}

/** Un feed RSS 2.0, RSS 1.0 o Atom → su título y sus titulares (sin DOM: en Cloudflare no lo hay). */
export function parseFeed(xml: string, url: string): { title: string; items: FeedItem[] } {
	const body = xml.replace(/<!--[\s\S]*?-->/g, '');
	const first = body.search(/<(item|entry)[\s>]/i);
	const head = first < 0 ? body : body.slice(0, first);
	const title = text(tag(head, 'title'), RSS_LIMITS.title) || new URL(url).hostname;
	const items: FeedItem[] = [];
	for (const m of body.matchAll(/<(item|entry)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi)) {
		if (items.length >= RSS_LIMITS.perFeed) break;
		const block = m[2];
		const t = text(tag(block, 'title'), RSS_LIMITS.title);
		const link = linkOf(block, url);
		if (!t || !link) continue;
		const when = text(
			tag(block, 'pubDate') ?? tag(block, 'published') ?? tag(block, 'updated') ?? tag(block, 'dc:date'),
			80
		);
		const at = when ? Date.parse(when) : NaN;
		items.push({ feed: url, title: t, link, at: Number.isFinite(at) ? at : null });
	}
	return { title, items };
}

/** Lee como mucho `max` bytes; si el feed es más grande, falla (no se corta a medias). */
async function readCapped(res: Response, max: number): Promise<string> {
	if (Number(res.headers.get('content-length') ?? 0) > max) throw new Error('grande');
	if (!res.body) return '';
	const reader = res.body.getReader();
	const chunks: Uint8Array[] = [];
	let size = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		size += value.byteLength;
		if (size > max) {
			await reader.cancel();
			throw new Error('grande');
		}
		chunks.push(value);
	}
	const all = new Uint8Array(size);
	let at = 0;
	for (const c of chunks) {
		all.set(c, at);
		at += c.byteLength;
	}
	return new TextDecoder().decode(all);
}

/** Caché por feed, compartida por todos en el mismo servidor de Cloudflare (no guarda nada del usuario). */
const cache = new Map<string, { at: number; title: string; items: FeedItem[] }>();
export const clearRssCache = () => cache.clear();

async function loadFeed(url: string, fetcher: Fetch): Promise<{ title: string; items: FeedItem[] }> {
	const hit = cache.get(url);
	if (hit && Date.now() - hit.at < RSS_LIMITS.ttl) return hit;
	let current = url;
	for (let hop = 0; ; hop++) {
		const res = await fetcher(current, {
			redirect: 'manual',
			signal: AbortSignal.timeout(RSS_LIMITS.timeout),
			headers: { accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5' }
		});
		if (res.status >= 300 && res.status < 400) {
			const next = feedUrl(new URL(res.headers.get('location') ?? '', current).href);
			if (!next || hop >= RSS_LIMITS.redirects) throw new Error('redirección');
			current = next;
			continue;
		}
		if (!res.ok) throw new Error(String(res.status));
		const parsed = parseFeed(await readCapped(res, RSS_LIMITS.bytes), url);
		if (cache.size >= RSS_LIMITS.cache) cache.delete(cache.keys().next().value!);
		cache.set(url, { at: Date.now(), ...parsed });
		return parsed;
	}
}

/** Todos los titulares de una lista, juntos y de más nuevo a más viejo. Un feed caído no tumba los demás. */
export async function readFeeds(feeds: string[], fetcher: Fetch): Promise<{ feeds: FeedStatus[]; items: FeedItem[] }> {
	const results = await Promise.all(
		feeds.map((url) =>
			loadFeed(url, fetcher).then(
				(r) => ({ url, title: r.title, ok: true, items: r.items }),
				() => ({ url, title: new URL(url).hostname, ok: false, items: [] as FeedItem[] })
			)
		)
	);
	const items = results
		.flatMap((r) => r.items)
		.sort((a, b) => (b.at ?? 0) - (a.at ?? 0))
		.slice(0, RSS_LIMITS.items);
	return { feeds: results.map(({ url, title, ok }) => ({ url, title, ok })), items };
}

export async function handleRss(
	request: Request,
	env: Env,
	store: RssStore | null,
	fetcher?: (url: string) => Promise<Response>,
	feedFetch: Fetch = (u, i) => fetch(u, i)
): Promise<Response> {
	if (!store) return json(503, { error: 'sin configurar' });
	// Sin configurar, desde otra web, sin identificar o un token de servicio: fuera (access.ts).
	const who = await person(request, env, fetcher);
	if (who instanceof Response) return who;
	const user = who.email;

	if (request.method === 'GET') {
		const feeds = await store.get(user);
		if (new URL(request.url).searchParams.get('items') !== '1') return json(200, { feeds });
		return json(200, await readFeeds(feeds, feedFetch));
	}

	if (request.method === 'PUT') {
		if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json')
			return json(415, { error: 'solo JSON' });
		const raw = await request.text();
		if (raw.length > RSS_LIMITS.body) return json(413, { error: 'demasiado grande' });
		let body: unknown;
		try {
			body = JSON.parse(raw);
		} catch {
			return json(400, { error: 'JSON no válido' });
		}
		const feeds = parseFeeds(body);
		if (typeof feeds === 'string') return json(400, { error: feeds });
		await store.put(user, feeds);
		return json(200, { feeds });
	}

	if (request.method === 'DELETE') {
		await store.remove(user);
		return json(200, { ok: true });
	}

	return json(405, { error: 'método' });
}

/** D1: tabla rss, una fila por persona con su lista en JSON. Se crea sola la primera vez (cloud/schema.ts). */
export function d1RssStore(db: D1Database): RssStore {
	const ready = () => ensure(db, 'rss');
	return {
		async get(user) {
			await ready();
			const { results } = await db.prepare('SELECT feeds FROM rss WHERE user = ?').bind(user).all<{ feeds: string }>();
			const list = results[0] ? parseFeeds({ feeds: JSON.parse(results[0].feeds) }) : [];
			return typeof list === 'string' ? [] : list;
		},
		async put(user, feeds) {
			await ready();
			await db
				.prepare(
					'INSERT INTO rss (user, feeds, updated) VALUES (?, ?, ?) ON CONFLICT (user) DO UPDATE SET feeds = excluded.feeds, updated = excluded.updated'
				)
				.bind(user, JSON.stringify(feeds), Date.now())
				.run();
		},
		async remove(user) {
			await ready();
			await db.prepare('DELETE FROM rss WHERE user = ?').bind(user).run();
		}
	};
}

/** En memoria, para los tests. */
export function memoryRssStore(): RssStore & { rows: Map<string, string[]> } {
	const rows = new Map<string, string[]>();
	return {
		rows,
		get: async (user) => [...(rows.get(user) ?? [])],
		put: async (user, feeds) => void rows.set(user, [...feeds]),
		remove: async (user) => void rows.delete(user)
	};
}
