import { describe, expect, it } from 'vitest';
import { parseDecimal, showDecimal } from './decimal.ts';

describe('parseDecimal', () => {
	it('coma o punto decimal (antes «2,5» se quedaba en 25)', () => {
		expect(parseDecimal('2,5')).toBe(2.5);
		expect(parseDecimal('2.5')).toBe(2.5);
		expect(parseDecimal('0,75')).toBe(0.75);
		expect(parseDecimal(',5')).toBe(0.5);
		expect(parseDecimal('-1,25')).toBe(-1.25);
		expect(parseDecimal('−1,25')).toBe(-1.25);
	});
	it('mientras escribes: «2,» ya vale 2', () => {
		expect(parseDecimal('2,')).toBe(2);
	});
	it('importes: punto de miles y espacios', () => {
		expect(parseDecimal('150.000', true)).toBe(150000);
		expect(parseDecimal('1.250.000,50', true)).toBe(1250000.5);
		expect(parseDecimal('150 000 €', true)).toBe(150000);
		// Sin `thousands` (un tipo de interés), el punto es decimal.
		expect(parseDecimal('3.125')).toBe(3.125);
		// Con `thousands`, si no son grupos de tres, también.
		expect(parseDecimal('2.5', true)).toBe(2.5);
	});
	it('vacío o basura: null', () => {
		expect(parseDecimal('')).toBeNull();
		expect(parseDecimal('  ')).toBeNull();
		expect(parseDecimal('abc')).toBeNull();
		expect(parseDecimal('1,2,3')).toBeNull();
		expect(parseDecimal('-')).toBeNull();
	});
});

describe('showDecimal', () => {
	it('con coma y sin miles', () => {
		expect(showDecimal(2.5)).toBe('2,5');
		expect(showDecimal(150000)).toBe('150000');
		expect(showDecimal(0.1 + 0.2)).toBe('0,3');
	});
	it('nada si no hay número', () => {
		expect(showDecimal(null)).toBe('');
		expect(showDecimal(Number.NaN)).toBe('');
	});
});
