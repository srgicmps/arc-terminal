import { describe, expect, it } from 'vitest';
import { cleanPosition, parseDecimal, parsePortfolio, summarize } from './portfolio.ts';
import type { Quote } from './types.ts';

const rates = new Map([
	['EUR', { perEur: 1, date: '2026-10-14' }],
	['USD', { perEur: 1.25, date: '2026-10-14' }]
]);
const q = (symbol: string, price: number): Quote => ({ symbol, price, change: null, changePct: 1.5, prevClose: null, time: null });

describe('cleanPosition y parsePortfolio', () => {
	it('acepta lo válido y normaliza', () => {
		expect(cleanPosition({ sym: ' nvda ', qty: 10, cost: 100, cur: 'usd', sector: ' Chips ' })).toEqual({ sym: 'NVDA', qty: 10, cost: 100, cur: 'USD', sector: 'Chips' });
	});
	it('descarta lo que no vale', () => {
		for (const bad of [null, 'x', { sym: '', qty: 1, cost: 1, cur: 'USD' }, { sym: 'A', qty: 0, cost: 1, cur: 'USD' }, { sym: 'A', qty: 1, cost: 1, cur: 'DOLAR' }, { sym: '<b>', qty: 1, cost: 1, cur: 'USD' }])
			expect(cleanPosition(bad)).toBeNull();
		expect(parsePortfolio('no es JSON')).toEqual([]);
		expect(parsePortfolio('{"a":1}')).toEqual([]);
		expect(parsePortfolio(null)).toEqual([]);
	});
});

describe('summarize', () => {
	it('valora en euros: Finnhub para USD, a mano para el resto', () => {
		const s = summarize(
			[
				{ sym: 'NVDA', qty: 10, cost: 100, cur: 'USD', sector: 'Chips' },
				{ sym: 'SAN.MC', qty: 100, cost: 4, cur: 'EUR', price: 5, sector: 'Banca' },
				{ sym: 'XYZ', qty: 1, cost: 10, cur: 'USD' }
			],
			[q('NVDA', 150)],
			rates
		);
		const [nvda, san, xyz] = s.rows;
		expect(nvda.source).toBe('finnhub');
		expect(nvda.value).toBeCloseTo(1200);
		expect(nvda.gain).toBeCloseTo(400);
		expect(nvda.gainPct).toBeCloseTo(50);
		expect(san.source).toBe('manual');
		expect(san.gain).toBeCloseTo(100);
		expect(xyz.source).toBeNull();
		expect(s.missing).toEqual(['XYZ']);
		expect(s.value).toBeCloseTo(1700);
		expect(s.invested).toBeCloseTo(1200);
		expect(s.bySector.map((g) => g.name)).toEqual(['Chips', 'Banca']);
		expect(s.byCurrency[0]).toMatchObject({ name: 'USD' });
		expect(nvda.weight! + san.weight!).toBeCloseTo(100);
	});
	it('la cotización de Finnhub no se aplica a una posición en otra divisa', () => {
		const s = summarize([{ sym: 'SAP', qty: 1, cost: 100, cur: 'EUR' }], [q('SAP', 200)], rates);
		expect(s.rows[0].source).toBeNull();
	});
	it('en euros no hace falta el cambio del BCE', () => {
		expect(summarize([{ sym: 'SAN.MC', qty: 2, cost: 4, cur: 'EUR', price: 5 }], [], new Map()).value).toBe(10);
	});
	it('«NASDAQ:NVDA» usa la cotización de NVDA', () => {
		expect(summarize([{ sym: 'NASDAQ:NVDA', qty: 1, cost: 1, cur: 'USD' }], [q('NVDA', 2)], rates).rows[0].source).toBe('finnhub');
	});
});

describe('parseDecimal', () => {
	it('entiende la coma decimal y el punto de miles', () => {
		expect(parseDecimal('1,5')).toBe(1.5);
		expect(parseDecimal('1.5')).toBe(1.5);
		// Antes «1.500» acciones se guardaban como 1,5 sin avisar.
		expect(parseDecimal('1.500')).toBe(1500);
		expect(parseDecimal('1.234,56')).toBe(1234.56);
		expect(parseDecimal(' 120,50 ')).toBe(120.5);
		expect(parseDecimal('')).toBeNaN();
		expect(parseDecimal('12a')).toBeNaN();
	});
});
