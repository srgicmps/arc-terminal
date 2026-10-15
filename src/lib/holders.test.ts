import { describe, expect, it } from 'vitest';
import { buildHolders, issuerKey, issuersFor, tickerKeys } from './holders.ts';
import { findIssuers, mostShared } from './holders-search.ts';

const line = (cusip: string, name: string, value: number, shares = value) => ({ cusip, name, value, shares });

describe('HDS: invertir las carteras 13F', () => {
	const issuers = buildHolders(
		[
			{ fund: 'BRK', current: [line('A', 'Apple Inc', 300), line('K', 'Kraft Heinz Co', 100)], previous: [line('A', 'Apple Inc', 400), line('K', 'Kraft Heinz Co', 100)] },
			{ fund: 'ARK', current: [line('T', 'Tesla Inc', 50), line('A', 'Apple Inc', 10)], previous: [line('T', 'Tesla Inc', 25)] },
			{ fund: 'BW', current: [line('A', 'Apple Inc', 20)], previous: null }
		],
		1
	);

	it('solo los que están entre las mayores de algún fondo, con todos sus fondos', () => {
		expect(issuers.map((e) => e.cusip)).toEqual(['A', 'T']);
		const apple = issuers[0];
		expect(apple.total).toBe(330);
		expect(apple.holders.map((h) => h.fund)).toEqual(['BRK', 'BW', 'ARK']);
	});

	it('puesto, peso y cambio frente al trimestre anterior', () => {
		const [brk, bw, ark] = issuers[0].holders;
		expect(brk).toMatchObject({ rank: 1, weight: 0.75, change: 'trim', pct: -0.25 });
		expect(bw).toMatchObject({ rank: 1, change: null, pct: null });
		expect(ark).toMatchObject({ rank: 2, change: 'new', pct: null });
		expect(issuers[1].holders[0]).toMatchObject({ change: 'add', pct: 1 });
	});
});

describe('HDS: de un código de la barra a su emisor', () => {
	it('quita la forma jurídica y la clase', () => {
		expect(issuerKey('NVIDIA CORPORATION')).toBe('nvidia');
		expect(issuerKey('JPMorgan Chase & Co')).toBe('jpmorgan chase');
		expect(issuerKey('Alphabet Inc Cap Stk Cl C')).toBe('alphabet cap stk');
	});

	it('busca por su nombre y el del 13F, sin alias', () => {
		expect(tickerKeys('AMD')).toContain('advanced micro devices');
		expect(tickerKeys('JPM')).toEqual(['jpmorgan']);
		expect(tickerKeys('NADA')).toEqual([]);
	});

	it('encuentra el emisor, también con varias clases', () => {
		const list = [line('1', 'Alphabet Inc Cl A', 1), line('2', 'Alphabet Inc Cap Stk Cl C', 1), line('3', 'JPMorgan Chase & Co', 1), line('4', 'Metallica Corp', 1), line('5', 'Meta Platforms Inc', 1)].map((l) => ({ ...l, total: 1, holders: [] }));
		expect(issuersFor('GOOGL', list).map((e) => e.cusip)).toEqual(['1', '2']);
		expect(issuersFor('JPM', list).map((e) => e.cusip)).toEqual(['3']);
		expect(issuersFor('META', list).map((e) => e.cusip)).toEqual(['5']);
	});
});

describe('HDS: buscar', () => {
	const list = [line('1', 'NVIDIA Corporation', 5), line('2', 'Kraft Heinz Co', 3), line('3', 'Apple Inc', 9)].map((l, i) => ({
		...l,
		total: l.value,
		holders: Array.from({ length: i + 1 }, () => ({ fund: 'X', value: 1, shares: 1, weight: 0, rank: 1, change: null, pct: null }))
	}));

	it('por código de la barra o por palabras del nombre', () => {
		expect(findIssuers('nvda', list).map((e) => e.cusip)).toEqual(['1']);
		expect(findIssuers('kraft', list).map((e) => e.cusip)).toEqual(['2']);
		expect(findIssuers('MSFT', list)).toEqual([]);
		expect(findIssuers(' ', list)).toEqual([]);
	});

	it('los más repartidos primero', () => {
		expect(mostShared(list).map((e) => e.cusip)).toEqual(['3', '2', '1']);
	});
});
