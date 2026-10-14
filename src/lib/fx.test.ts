// Conversor de divisas: cruces a través del euro con los tipos de referencia del BCE.
import { describe, expect, it } from 'vitest';
import { convert, fxRates } from './fx.ts';
import type { Series } from './types.ts';

const serie = (id: string, v: number, t = '2026-10-13'): Series => ({
	id,
	label: id,
	unit: '',
	points: [
		{ t: '2026-10-10', v: v * 0.99 },
		{ t, v }
	],
	source: 'BCE'
});

const rates = fxRates([serie('eurusd', 1.0842), serie('eurgbp', 0.8655), serie('eurjpy', 162.5, '2026-10-12'), undefined]);

describe('fxRates', () => {
	it('lee el último tipo de cada divisa y añade el euro con la fecha más reciente', () => {
		expect(rates.get('USD')).toEqual({ perEur: 1.0842, date: '2026-10-13' });
		expect(rates.get('JPY')?.date).toBe('2026-10-12');
		expect(rates.get('EUR')).toEqual({ perEur: 1, date: '2026-10-13' });
	});

	it('sin series no hay euro ni divisas', () => {
		expect(fxRates([]).size).toBe(0);
	});
});

describe('convert', () => {
	it('de euros y a euros', () => {
		expect(convert(100, 'EUR', 'USD', rates)).toBeCloseTo(108.42, 6);
		expect(convert(108.42, 'USD', 'EUR', rates)).toBeCloseTo(100, 6);
	});

	it('cruza dos divisas a través del euro', () => {
		// 100 USD → 92,233 EUR → 79,83 GBP
		expect(convert(100, 'USD', 'GBP', rates)).toBeCloseTo((100 / 1.0842) * 0.8655, 6);
		expect(convert(5, 'GBP', 'GBP', rates)).toBeCloseTo(5, 10);
	});

	it('devuelve null si falta una divisa o la cantidad', () => {
		expect(convert(100, 'EUR', 'CHF', rates)).toBeNull();
		expect(convert(Number.NaN, 'EUR', 'USD', rates)).toBeNull();
	});
});
