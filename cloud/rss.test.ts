import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { clearKeyCache } from './access.ts';
import { clearRssCache, feedUrl, handleRss, memoryRssStore, parseFeed, RSS_LIMITS } from './rss.ts';
import { ENV, testKeys } from './testkeys.ts';

let k: Awaited<ReturnType<typeof testKeys>>;
beforeAll(async () => void (k = await testKeys()));
beforeEach(() => {
	clearKeyCache();
	clearRssCache();
});

const RSS = `<?xml version="1.0"?><rss><channel><title>Mi blog &amp; más</title><link>https://blog.es/</link>
<item><title><![CDATA[Uno <b>nuevo</b>]]></title><link>https://blog.es/1</link><pubDate>Wed, 14 Oct 2026 10:00:00 GMT</pubDate><description>&lt;script&gt;x&lt;/script&gt;</description></item>
<item><title>Malo</title><link>javascript:alert(1)</link></item>
<item><title>Dos</title><link>/2</link><pubDate>Thu, 15 Oct 2026 10:00:00 GMT</pubDate></item>
</channel></rss>`;
const ATOM = `<feed xmlns="http://www.w3.org/2005/Atom"><title type="text">Atom</title>
<entry><title>Tres</title><link rel="self" href="https://a.org/self"/><link href="https://a.org/3"/><updated>2026-10-13T00:00:00Z</updated></entry></feed>`;

describe('parseFeed', () => {
	it('RSS: título, CDATA sin etiquetas, enlaces relativos y fuera los javascript:', () => {
		const f = parseFeed(RSS, 'https://blog.es/feed');
		expect(f.title).toBe('Mi blog & más');
		expect(f.items.map((i) => [i.title, i.link])).toEqual([
			['Uno nuevo', 'https://blog.es/1'],
			['Dos', 'https://blog.es/2']
		]);
		expect(f.items[0].at).toBe(Date.parse('2026-10-14T10:00:00Z'));
	});
	it('Atom: el enlace alternate, no el self', () => {
		const f = parseFeed(ATOM, 'https://a.org/feed');
		expect(f.title).toBe('Atom');
		expect(f.items[0]).toMatchObject({ title: 'Tres', link: 'https://a.org/3' });
	});
	it('con tope de titulares por feed', () => {
		const many = `<rss>${Array.from({ length: 50 }, (_, i) => `<item><title>t${i}</title><link>https://x.es/${i}</link></item>`).join('')}</rss>`;
		expect(parseFeed(many, 'https://x.es/f').items).toHaveLength(RSS_LIMITS.perFeed);
	});
});

describe('feedUrl', () => {
	it('solo http(s) a nombres públicos', () => {
		expect(feedUrl('https://elpais.com/rss#x')).toBe('https://elpais.com/rss');
		for (const bad of ['ftp://a.es/f', 'http://localhost/x', 'http://127.0.0.1/x', 'http://[::1]/', 'https://a.es:8443/', 'https://u:p@a.es/', 'http://router.lan/', 'https://intranet/', 'file:///etc/passwd', 42])
			expect(feedUrl(bad)).toBeNull();
	});
});

const call = async (
	store: ReturnType<typeof memoryRssStore>,
	who: Record<string, unknown> | null,
	method = 'GET',
	body?: unknown,
	query = '',
	feeds: (u: string, i?: RequestInit) => Promise<Response> = async () => new Response('', { status: 500 })
) =>
	handleRss(
		new Request(`https://arcterminal.dev/api/rss${query}`, {
			method,
			headers: {
				...(who ? { 'cf-access-jwt-assertion': await k.sign(who) } : {}),
				...(body ? { 'content-type': 'application/json' } : {})
			},
			body: body ? JSON.stringify(body) : undefined
		}),
		ENV,
		store,
		k.certs,
		feeds
	);

describe('/api/rss', () => {
	it('cada uno ve solo su lista', async () => {
		const store = memoryRssStore();
		await call(store, { email: 'ana@x.es' }, 'PUT', { feeds: ['https://blog.es/feed', 'https://blog.es/feed'] });
		expect(await (await call(store, { email: 'ana@x.es' })).json()).toEqual({ feeds: ['https://blog.es/feed'] });
		expect(await (await call(store, { email: 'luis@x.es' })).json()).toEqual({ feeds: [] });
	});
	it('sin cuenta, 401; un token de servicio, 403; URLs malas o demasiadas, 400', async () => {
		const store = memoryRssStore();
		expect((await call(store, null)).status).toBe(401);
		expect((await call(store, { common_name: 'action' })).status).toBe(403);
		expect((await call(store, { email: 'a@x.es' }, 'PUT', { feeds: ['http://127.0.0.1/'] })).status).toBe(400);
		const many = Array.from({ length: 21 }, (_, i) => `https://a${i}.es/f`);
		expect((await call(store, { email: 'a@x.es' }, 'PUT', { feeds: many })).status).toBe(400);
		expect(store.rows.size).toBe(0);
	});
	it('?items=1 junta los titulares, ordena por fecha y aguanta un feed caído', async () => {
		const store = memoryRssStore();
		await store.put('ana@x.es', ['https://blog.es/feed', 'https://a.org/feed', 'https://caido.es/f']);
		let calls = 0;
		const fetcher = async (u: string) => {
			calls++;
			if (u === 'https://blog.es/feed') return new Response(RSS);
			if (u === 'https://a.org/feed') return new Response(ATOM);
			return new Response('', { status: 404 });
		};
		const body = await (await call(store, { email: 'ana@x.es' }, 'GET', undefined, '?items=1', fetcher)).json();
		expect(body.items.map((i: { title: string }) => i.title)).toEqual(['Dos', 'Uno nuevo', 'Tres']);
		expect(body.feeds.map((f: { ok: boolean }) => f.ok)).toEqual([true, true, false]);
		// La segunda vez, de la caché (el caído se reintenta).
		await call(store, { email: 'ana@x.es' }, 'GET', undefined, '?items=1', fetcher);
		expect(calls).toBe(4);
	});
	it('no sigue redirecciones a sitios internos ni lee feeds enormes', async () => {
		const store = memoryRssStore();
		await store.put('ana@x.es', ['https://r.es/f', 'https://big.es/f']);
		const fetcher = async (u: string) =>
			u === 'https://r.es/f'
				? new Response('', { status: 302, headers: { location: 'http://169.254.169.254/' } })
				: new Response('x'.repeat(RSS_LIMITS.bytes + 1));
		const body = await (await call(store, { email: 'ana@x.es' }, 'GET', undefined, '?items=1', fetcher)).json();
		expect(body.feeds.map((f: { ok: boolean }) => f.ok)).toEqual([false, false]);
	});
});
