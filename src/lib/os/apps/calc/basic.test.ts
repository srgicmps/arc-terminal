import { describe, expect, it } from 'vitest';
import { evaluate } from '../../../calc.ts';
import { afterResult, percentOf } from './basic.ts';

const run = (e: string) => evaluate(percentOf(e));

describe('Calculadora normal', () => {
	it('suma y resta porcentajes como una calculadora de bolsillo', () => {
		expect(run('200+10%')).toBeCloseTo(220);
		expect(run('200−10%')).toBeCloseTo(180);
		expect(run('100+50+10%')).toBeCloseTo(165);
		expect(run('(1+2)×100−25%')).toBeCloseTo(225);
		expect(run('1.250,5+21%')).toBeNull(); // «1.250,5» no es una cuenta válida (evaluate no entiende miles)
		expect(run('1250,5+21%')).toBeCloseTo(1513.105);
	});

	it('deja igual el resto de porcentajes', () => {
		expect(run('50×10%')).toBeCloseTo(5);
		expect(run('10%')).toBeCloseTo(0.1);
		expect(run('2×−10%')).toBeCloseTo(-0.2);
		expect(percentOf('2×(100+10%')).toBe('2×(100+10%');
		expect(run('2×(100+10%)')).toBeCloseTo(200.2);
	});

	it('tras «=», una cifra empieza otra cuenta y un operador sigue', () => {
		expect(afterResult('36', '5')).toBe('5');
		expect(afterResult('36', ',')).toBe(',');
		expect(afterResult('36', '+')).toBe('36+');
		expect(afterResult('36', '×')).toBe('36×');
	});
});
