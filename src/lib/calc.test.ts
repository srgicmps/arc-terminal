import { describe, expect, it } from 'vitest';
import { evaluate, formatResult, parseConversion, plainResult } from './calc.ts';

describe('evaluate (M46)', () => {
	it('cuentas con precedencia y paréntesis', () => {
		expect(evaluate('1250*1.21')).toBeCloseTo(1512.5);
		expect(evaluate('1250*1,21')).toBeCloseTo(1512.5);
		expect(evaluate('2+3*4')).toBe(14);
		expect(evaluate('(2+3)*4')).toBe(20);
		expect(evaluate('10/4')).toBe(2.5);
		expect(evaluate('2^3^2')).toBe(512);
		expect(evaluate('-2^2')).toBe(-4);
		expect(evaluate('3 × 4 ÷ 2 − 1')).toBe(5);
	});

	it('porcentajes', () => {
		expect(evaluate('200*21%')).toBeCloseTo(42);
		expect(evaluate('50%')).toBe(0.5);
	});

	it('lo que no es una cuenta', () => {
		expect(evaluate('')).toBeNull();
		expect(evaluate('1/0')).toBeNull();
		expect(evaluate('2+')).toBeNull();
		expect(evaluate('(1+2')).toBeNull();
		expect(evaluate('alert(1)')).toBeNull();
		expect(evaluate('1 2')).toBeNull();
	});
});

describe('parseConversion (M46)', () => {
	it('cantidad y dos divisas', () => {
		expect(parseConversion('100 USD EUR')).toEqual({ amount: 100, from: 'USD', to: 'EUR' });
		expect(parseConversion('100usd a eur')).toEqual({ amount: 100, from: 'USD', to: 'EUR' });
		expect(parseConversion('2.500,5 gbp en usd')).toEqual({ amount: 2500.5, from: 'GBP', to: 'USD' });
		expect(parseConversion('1.5 EUR JPY')).toEqual({ amount: 1.5, from: 'EUR', to: 'JPY' });
		expect(parseConversion('2.500 EUR USD')?.amount).toBe(2500);
	});

	it('lo que no es una conversión', () => {
		expect(parseConversion('NVDA AMD')).toBeNull();
		expect(parseConversion('100 EUR')).toBeNull();
		expect(parseConversion('CMP NVDA AMD')).toBeNull();
	});
});

describe('formato', () => {
	it('en español y para seguir calculando', () => {
		expect(formatResult(1512.5)).toBe('1512,5');
		expect(formatResult(1234567.891)).toBe('1.234.567,891');
		expect(formatResult(0.1 + 0.2)).toBe('0,3');
		expect(plainResult(0.1 + 0.2)).toBe('0.3');
	});
});
