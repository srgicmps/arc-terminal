import { describe, expect, it, vi } from 'vitest';
import { feedError, newsSources, parseFeed } from '../sources/news.ts';
import { mockFetch } from './mock.ts';

const rss = (items: string) => `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel><title>Medio</title>${items}</channel></rss>`;

const item = (title: string, date: string, link = `https://example.org/${encodeURIComponent(title)}`) =>
	`<item><title>${title}</title><link>${link}</link><pubDate>${date}</pubDate></item>`;

describe('parseFeed', () => {
	it('lee RSS 2.0: título, enlace, fecha y resumen sin HTML', () => {
		const body = rss(`
			<item>
				<title><![CDATA[El BCE mantiene los tipos]]></title>
				<link>https://example.org/bce</link>
				<pubDate>Tue, 14 Oct 2026 10:00:00 +0200</pubDate>
				<description><![CDATA[<p>La entidad deja el tipo de depósito en el <b>2%</b> otra vez</p>]]></description>
			</item>`);
		expect(parseFeed(body, 'El País')).toEqual([
			{
				title: 'El BCE mantiene los tipos',
				url: 'https://example.org/bce',
				source: 'El País',
				time: '2026-10-14T08:00:00.000Z',
				summary: 'La entidad deja el tipo de depósito en el 2% otra vez'
			}
		]);
	});

	it('acepta un solo elemento, dc:date, content:encoded y guid como enlace', () => {
		const body = rss(`
			<item>
				<title>Sin enlace pero con guid</title>
				<guid isPermaLink="true">https://example.org/guid</guid>
				<dc:date>2026-10-14T06:30:00Z</dc:date>
				<content:encoded><![CDATA[<p>Cuerpo</p>]]></content:encoded>
			</item>`);
		const [news] = parseFeed(body, 'X');
		expect(news.url).toBe('https://example.org/guid');
		expect(news.time).toBe('2026-10-14T06:30:00.000Z');
		expect(news.summary).toBe('Cuerpo');
	});

	it('descarta las noticias sin título o sin enlace http y deja la fecha a null si no se entiende', () => {
		const body = rss(
			item('', 'Tue, 14 Oct 2026 10:00:00 GMT') +
				item('Relativo', 'Tue, 14 Oct 2026 10:00:00 GMT', '/relativo') +
				item('Sin fecha', 'ayer por la tarde')
		);
		const items = parseFeed(body, 'X');
		expect(items.map((i) => i.title)).toEqual(['Sin fecha']);
		expect(items[0].time).toBeNull();
	});

	it('lee Atom y prefiere el enlace «alternate»', () => {
		const body = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
	<entry>
		<title type="html">Llama &amp;amp; Mistral</title>
		<link rel="self" href="https://example.org/self"/>
		<link rel="alternate" type="text/html" href="https://example.org/post"/>
		<updated>2026-10-14T09:00:00Z</updated>
		<summary type="html">&lt;p&gt;Resumen&lt;/p&gt;</summary>
	</entry>
	<entry>
		<title>Otra</title>
		<link href="https://example.org/otra"/>
		<published>2026-10-13T09:00:00Z</published>
	</entry>
</feed>`;
		const items = parseFeed(body, 'Simon Willison');
		expect(items).toEqual([
			{ title: 'Llama & Mistral', url: 'https://example.org/post', source: 'Simon Willison', time: '2026-10-14T09:00:00.000Z', summary: 'Resumen' },
			{ title: 'Otra', url: 'https://example.org/otra', source: 'Simon Willison', time: '2026-10-13T09:00:00.000Z', summary: '' }
		]);
	});

	it('lee RSS 1.0 (RDF)', () => {
		const body = `<?xml version="1.0"?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://purl.org/rss/1.0/" xmlns:dc="http://purl.org/dc/elements/1.1/">
	<item rdf:about="https://example.org/a"><title>Uno</title><link>https://example.org/a</link><dc:date>2026-10-14T08:00:00+02:00</dc:date></item>
	<item rdf:about="https://example.org/b"><title>Dos</title><link>https://example.org/b</link></item>
</rdf:RDF>`;
		const items = parseFeed(body, 'X');
		expect(items.map((i) => [i.title, i.url, i.time])).toEqual([
			['Uno', 'https://example.org/a', '2026-10-14T06:00:00.000Z'],
			['Dos', 'https://example.org/b', null]
		]);
	});

	it('no confunde <media:title> ni <itunes:summary> con el título y el resumen (Expansión, El Mundo)', () => {
		const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
<channel><title><![CDATA[Economía // expansion]]></title><atom:link href="https://example.org/rss.xml" rel="self" type="application/rss+xml" />
	<item><title><![CDATA[La inflación repunta al 3,7 %]]></title><description><![CDATA[Los carburantes tiran de los precios.&nbsp;<a href="https://example.org/a">Leer</a>]]></description><dc:creator><![CDATA[Redacción]]></dc:creator><link>https://example.org/a</link><media:description type="html"><![CDATA[Otro resumen]]></media:description><media:title type="html"><![CDATA[ECONOMIA]]></media:title><itunes:summary>Resumen de iTunes</itunes:summary><atom:link href="https://example.org/a" rel="self" /><guid>https://example.org/a</guid><pubDate>Wed, 14 Oct 2026 14:49:59 +0200</pubDate></item>
</channel></rss>`;
		expect(parseFeed(body, 'Expansión')).toEqual([
			{
				title: 'La inflación repunta al 3,7 %',
				url: 'https://example.org/a',
				source: 'Expansión',
				time: '2026-10-14T12:49:59.000Z',
				summary: 'Los carburantes tiran de los precios. Leer'
			}
		]);
	});

	it('devuelve una lista vacía si el documento no es un feed', () => {
		expect(parseFeed('<html><body>Error</body></html>', 'X')).toEqual([]);
	});
});

describe('secciones de titulares', () => {
	const eco = newsSources.find((s) => s.name === 'news-eco')!;

	it('hay una fuente por sección', () => {
		expect(newsSources.map((s) => s.name)).toEqual([
			'news-eco',
			'news-geo',
			'news-es',
			'news-ws',
			'news-tech',
			'news-ai',
			'news-gov',
			'news-intl'
		]);
		expect(eco.label).toMatch(/^Titulares de Economía · El País, Expansión/);
	});

	it('junta los medios, quita duplicados, ordena por fecha y apunta los que fallan', async () => {
		vi.spyOn(console, 'log').mockImplementation(() => {});
		mockFetch((url) => {
			if (url.includes('elpais.com'))
				return rss(
					item('Primera', 'Tue, 14 Oct 2026 08:00:00 GMT') + item('Repetida', 'Tue, 14 Oct 2026 07:00:00 GMT')
				);
			if (url.includes('expansion'))
				return rss(item('REPETIDA', 'Tue, 14 Oct 2026 09:00:00 GMT') + item('Última', 'Tue, 14 Oct 2026 10:00:00 GMT'));
			if (url.includes('ft.com')) return rss(item('Sin fecha', 'no'));
			return undefined;
		});
		const data = await eco.fetch(undefined);
		expect(data.items.map((i) => [i.title, i.source])).toEqual([
			['Última', 'Expansión'],
			['Primera', 'El País'],
			['Repetida', 'El País'],
			['Sin fecha', 'Financial Times']
		]);
		expect(data.feeds).toEqual([
			{ name: 'El País', ok: true, items: 2 },
			{ name: 'Expansión', ok: true, items: 2 },
			{ name: 'El Confidencial', ok: false, items: 0, error: 'HTTP 404' },
			{ name: 'Financial Times', ok: true, items: 1 },
			{ name: 'BCE', ok: false, items: 0, error: 'HTTP 404' },
			{ name: 'The Economist', ok: false, items: 0, error: 'HTTP 404' }
		]);
	});

	it('guarda como mucho 15 titulares por medio', async () => {
		vi.spyOn(console, 'log').mockImplementation(() => {});
		const many = Array.from({ length: 20 }, (_, i) => item(`N${i}`, `Tue, 14 Oct 2026 ${String(i).padStart(2, '0')}:00:00 GMT`)).join('');
		mockFetch((url) => (url.includes('elpais.com') ? rss(many) : undefined));
		const data = await eco.fetch(undefined);
		expect(data.items).toHaveLength(15);
		expect(data.feeds[0]).toEqual({ name: 'El País', ok: true, items: 15 });
	});

	it('falla si no responde ningún medio', async () => {
		vi.spyOn(console, 'log').mockImplementation(() => {});
		mockFetch(() => undefined);
		await expect(eco.fetch(undefined)).rejects.toThrow('ningún feed');
	});
});

describe('salud de cada canal', () => {
	const eco = newsSources.find((s) => s.name === 'news-eco')!;

	it('apunta por canal si responde, cuántos titulares trae y un error corto sin URL', async () => {
		vi.spyOn(console, 'log').mockImplementation(() => {});
		mockFetch((url) => {
			if (url.includes('elpais.com')) return rss(item('Uno', 'Tue, 14 Oct 2026 08:00:00 GMT') + item('Dos', 'Tue, 14 Oct 2026 07:00:00 GMT'));
			if (url.includes('expansion')) return '<rss><channel><item><title>Roto</title></channel>';
			if (url.includes('elconfidencial')) return '<html><body>Mantenimiento</body></html>';
			return undefined;
		});
		const data = await eco.fetch(undefined);
		expect(data.feeds.slice(0, 4)).toEqual([
			{ name: 'El País', ok: true, items: 2 },
			{ name: 'Expansión', ok: false, items: 0, error: 'XML no válido' },
			{ name: 'El Confidencial', ok: false, items: 0, error: 'sin titulares' },
			{ name: 'Financial Times', ok: false, items: 0, error: 'HTTP 404' }
		]);
		// El JSON es público: ningún error lleva la URL del canal (la del FT lleva «?format=rss»).
		expect(JSON.stringify(data.feeds)).not.toMatch(/https?:|ft\.com/);
	});

	it('resume los errores en pocas palabras', () => {
		expect(feedError(new Error('HTTP 503 en https://example.org/rss?token=x'))).toBe('HTTP 503');
		expect(feedError(Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' }))).toBe(
			'tiempo agotado'
		);
		expect(feedError(new TypeError('fetch failed'))).toBe('sin conexión');
		expect(feedError(new Error('XML no válido'))).toBe('XML no válido');
		expect(feedError(new Error('algo raro en https://example.org/?a=1'))).toBe('error');
	});
});
