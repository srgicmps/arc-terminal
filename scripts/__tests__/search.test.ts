import { describe, expect, it } from 'vitest';
import { makeContext } from '../lib.ts';
import { boeEntries, buildIndex, clip, MAX_BYTES, MAX_TITLE, newsEntries, search, tickerEntries } from '../sources/search.ts';
import { TICKERS } from '../../src/lib/tickers.ts';
import type { BoeData, NewsItem, SearchEntry } from '../../src/lib/types.ts';

const NOW = Date.parse('2026-10-14T12:00:00Z');
const HOUR = 3_600_000;
const news = (title: string, url: string, hoursAgo = 1, also?: NewsItem['also']): NewsItem => ({
	title,
	url,
	source: 'El País',
	time: new Date(NOW - hoursAgo * HOUR).toISOString(),
	summary: '',
	also
});

const boe = (titles: [string, string][]): BoeData => ({
	date: '2026-10-14',
	number: '247',
	pdf: '',
	sections: titles.map(([code, title], i) => ({
		code,
		name: code,
		total: 1,
		items: [{ id: `BOE-A-${i}`, title, dept: 'X', epigraph: '', html: `https://www.boe.es/${i}`, pdf: '' }]
	}))
});

describe('clip', () => {
	it('recorta por un espacio y añade «…»', () => {
		const long = 'palabra '.repeat(40);
		const out = clip(long);
		expect(out.length).toBeLessThanOrEqual(MAX_TITLE);
		expect(out.endsWith('palabra…')).toBe(true);
		expect(clip('  corto  ')).toBe('corto');
	});
});

describe('newsEntries', () => {
	it('desduplica por enlace (también los agrupados en `also`) y descarta lo de más de 2 días', () => {
		const out = newsEntries(
			[
				[news('Uno', 'https://a.example/1?utm_source=x', 1, [{ source: 'ABC', url: 'https://www.b.example/2' }])],
				[news('Uno otra vez', 'https://a.example/1/'), news('Dos', 'https://b.example/2', 2), news('Viejo', 'https://c.example/3', 49)],
				[news('Tres', 'https://c.example/4', 0.5)]
			],
			NOW
		);
		expect(out).toEqual([
			{ t: 'Tres', u: 'https://c.example/4', s: 'NEWS' },
			{ t: 'Uno', u: 'https://a.example/1?utm_source=x', s: 'NEWS' }
		]);
	});
});

describe('boeEntries', () => {
	it('separa las secciones I–III de los anuncios y recorta los títulos', () => {
		const { main, rest } = boeEntries(boe([['1', 'Real Decreto ' + 'x'.repeat(400)], ['5A', 'Anuncio']]));
		expect(main).toHaveLength(1);
		expect(main[0].s).toBe('BOE');
		expect(main[0].t.length).toBeLessThanOrEqual(MAX_TITLE);
		expect(rest.map((e) => e.t)).toEqual(['Anuncio']);
		expect(boeEntries(undefined)).toEqual({ main: [], rest: [] });
	});
});

describe('buildIndex', () => {
	it('enlaza los valores a su ficha', () => {
		expect(tickerEntries()[0]).toEqual({ t: `${TICKERS[0].code} · ${TICKERS[0].name}`, u: `/s?sym=${TICKERS[0].code}`, s: 'Valor' });
	});

	it('se para antes de pasar del tamaño máximo, por orden de prioridad', () => {
		const many: SearchEntry[] = Array.from({ length: 5000 }, (_, i) => ({ t: `Titular ${i} `.padEnd(120, 'x'), u: `https://a.example/${i}`, s: 'NEWS' }));
		const out = buildIndex([tickerEntries(), many]);
		expect(Buffer.byteLength(JSON.stringify(out))).toBeLessThanOrEqual(MAX_BYTES);
		expect(out.slice(0, TICKERS.length)).toEqual(tickerEntries());
		expect(out.length).toBeGreaterThan(TICKERS.length + 500);
		expect(out.length).toBeLessThan(TICKERS.length + many.length);
	});

	it('la fuente junta valores, BOE y titulares de la misma pasada', async () => {
		const items = [news('Aranceles nuevos', 'https://a.example/1', 0)];
		items[0].time = new Date().toISOString();
		const ctx = makeContext(new Map<string, unknown>([['news-eco', { items, feeds: [] }], ['boe', boe([['1', 'Orden de aranceles']])]]));
		const out = await search.fetch(undefined, ctx);
		expect(search.after).toBe(true);
		expect(out.filter((e) => e.s !== 'Valor')).toEqual([
			{ t: 'Orden de aranceles', u: 'https://www.boe.es/0', s: 'BOE' },
			{ t: 'Aranceles nuevos', u: 'https://a.example/1', s: 'NEWS' }
		]);
	});

	it('falla (y se reutiliza la copia anterior) si no hay ni titulares ni BOE', async () => {
		await expect(search.fetch(undefined, makeContext(new Map()))).rejects.toThrow();
	});
});
