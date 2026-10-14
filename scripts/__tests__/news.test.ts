import { describe, expect, it, vi } from 'vitest';
import { newsSources, parseFeed } from '../sources/news.ts';
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
			'news-gov'
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
			{ name: 'El País', count: 2 },
			{ name: 'Expansión', count: 2 },
			{ name: 'El Confidencial', count: 0, error: expect.stringContaining('HTTP 404') },
			{ name: 'Financial Times', count: 1 },
			{ name: 'BCE', count: 0, error: expect.stringContaining('HTTP 404') },
			{ name: 'The Economist', count: 0, error: expect.stringContaining('HTTP 404') }
		]);
	});

	it('guarda como mucho 15 titulares por medio', async () => {
		vi.spyOn(console, 'log').mockImplementation(() => {});
		const many = Array.from({ length: 20 }, (_, i) => item(`N${i}`, `Tue, 14 Oct 2026 ${String(i).padStart(2, '0')}:00:00 GMT`)).join('');
		mockFetch((url) => (url.includes('elpais.com') ? rss(many) : undefined));
		const data = await eco.fetch(undefined);
		expect(data.items).toHaveLength(15);
		expect(data.feeds[0]).toEqual({ name: 'El País', count: 15 });
	});

	it('falla si no responde ningún medio', async () => {
		vi.spyOn(console, 'log').mockImplementation(() => {});
		mockFetch(() => undefined);
		await expect(eco.fetch(undefined)).rejects.toThrow('ningún feed');
	});
});
