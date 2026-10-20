import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanLinks, isSafeLink, LINK_KEYS, linksWarning } from '../links.ts';

describe('cleanLinks', () => {
	it('vacía «javascript:» y «data:» en las claves de enlace, también dentro de listas', () => {
		const data = {
			items: [
				{ title: 'Uno', url: 'javascript:alert(1)' },
				{ title: 'Dos', url: ' JaVa\tscript:alert(1)' },
				{ title: 'Tres', pdf: 'data:text/html,<script>alert(1)</script>', html: 'vbscript:msgbox(1)' }
			],
			paper: { arxiv: 'javascript:void(0)', page: '//otra.web/x', link: '/\\otra.web', href: 'mailto:a@b.c' }
		};
		expect(cleanLinks(data)).toBe(8);
		expect(data.items.map((i) => i.url ?? i.pdf)).toEqual(['', '', '']);
		expect(data.items[2].html).toBe('');
		expect(data.paper).toEqual({ arxiv: '', page: '', link: '', href: '' });
	});

	it('conserva los enlaces http(s) y las rutas de la propia web', () => {
		const data = [
			{ url: 'https://www.boe.es/boe/dias/2026/10/14/' },
			{ url: 'HTTP://example.org' },
			{ u: '/s?sym=NVDA' },
			{ url: ' https://con-espacio.example ' },
			{ url: '' }
		];
		const before = structuredClone(data);
		expect(cleanLinks(data)).toBe(0);
		expect(data).toEqual(before);
	});

	it('no toca los textos que no son enlaces, aunque empiecen por «JavaScript:»', () => {
		const data = { title: 'JavaScript: the good parts', summary: 'data: ...', id: 'javascript:1', source: 'HN', n: 3, url: null };
		const before = structuredClone(data);
		expect(cleanLinks(data)).toBe(0);
		expect(data).toEqual(before);
	});

	it('cuenta en cualquier profundidad y deja en paz lo que no es objeto', () => {
		expect(cleanLinks({ a: { b: [{ c: [{ url: 'javascript:x' }, { url: 'https://ok' }] }] } })).toBe(1);
		for (const value of [null, undefined, 'javascript:x', 3, []]) expect(cleanLinks(value)).toBe(0);
	});

	it('las claves de enlace son las que usan los datos de hoy', () => {
		expect([...LINK_KEYS].sort()).toEqual(['arxiv', 'href', 'html', 'link', 'page', 'pdf', 'u', 'url']);
		expect(isSafeLink('')).toBe(true);
		expect(isSafeLink('/')).toBe(true);
		expect(isSafeLink('ftp://x')).toBe(false);
	});
});

describe('linksWarning', () => {
	it('solo avisa si ha vaciado alguno, con la fuente y la cuenta', () => {
		expect(linksWarning('advisories', 0)).toBeNull();
		expect(linksWarning('advisories', 1)).toBe('::warning::advisories: 1 enlace no http(s) vaciado');
		expect(linksWarning('news-archive/2026-10.json', 3)).toBe('::warning::news-archive/2026-10.json: 3 enlaces no http(s) vaciados');
	});
});

describe('writeExtra', () => {
	afterEach(() => {
		vi.doUnmock('node:fs/promises');
		vi.restoreAllMocks();
	});

	it('limpia los enlaces antes de escribir y avisa en el registro', async () => {
		const writeFile = vi.fn(async () => {});
		vi.doMock('node:fs/promises', async (original) => ({ ...(await original<object>()), mkdir: vi.fn(async () => {}), writeFile }));
		const log = vi.spyOn(console, 'log').mockImplementation(() => {});
		const { writeExtra } = await import('../lib.ts');
		await writeExtra('x/y.json', [{ title: 'T', url: 'javascript:alert(1)' }]);
		expect(writeFile).toHaveBeenCalledWith('static/data/x/y.json', '[{"title":"T","url":""}]\n');
		expect(log).toHaveBeenCalledWith('::warning::x/y.json: 1 enlace no http(s) vaciado');
	});
});
