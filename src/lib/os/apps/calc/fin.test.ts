import { describe, expect, it } from 'vitest';
import { cagr, compound, loanPayment, parseNum } from './fin.ts';

describe('Calculadora financiera', () => {
	it('interés compuesto con y sin aportaciones', () => {
		expect(compound(1000, 0, 2, 100)).toBe(3400);
		expect(compound(1000, 12, 1)).toBeCloseTo(1126.83, 2);
		expect(compound(0, 6, 10, 100)).toBeCloseTo(16387.93, 1);
	});

	it('cuota de un préstamo francés', () => {
		expect(loanPayment(150000, 3, 25)).toBeCloseTo(711.32, 2);
		expect(loanPayment(1200, 0, 1)).toBe(100);
		expect(loanPayment(1000, 3, 0)).toBeNaN();
	});

	it('rentabilidad anual compuesta', () => {
		expect(cagr(100, 121, 2)).toBeCloseTo(10, 6);
		expect(cagr(0, 10, 1)).toBeNaN();
	});

	it('lee números en los dos formatos', () => {
		expect(parseNum('1.250,5')).toBe(1250.5);
		expect(parseNum('1250.5')).toBe(1250.5);
		expect(parseNum('3 %')).toBe(3);
		expect(parseNum('')).toBeNaN();
	});
});
