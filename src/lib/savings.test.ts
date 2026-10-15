import { describe, expect, it } from 'vitest';
import { compound, realValue } from './savings.ts';

describe('compound', () => {
	it('sin aportaciones: C · (1 + i/12)^(12·años)', () => {
		const g = compound(10_000, 0, 3, 10)!;
		expect(g.total).toBeCloseTo(10_000 * (1 + 0.03 / 12) ** 120, 6);
		expect(g.contributed).toBe(10_000);
		expect(g.years).toHaveLength(11);
	});
	it('con aportaciones al 0 %: suma lo aportado', () => {
		const g = compound(1000, 100, 0, 2)!;
		expect(g.total).toBeCloseTo(3400);
		expect(g.interest).toBeCloseTo(0);
	});
	it('fórmula de la renta: 100 €/mes al 6 % durante 30 años ≈ 100.452 €', () => {
		expect(compound(0, 100, 6, 30)!.total).toBeCloseTo(100_451.5, 0);
	});
	it('datos no válidos', () => {
		expect(compound(-1, 0, 3, 10)).toBeNull();
		expect(compound(1, 0, 3, 0)).toBeNull();
	});
});

describe('realValue', () => {
	const index = [
		{ t: '2005-01', v: 70 },
		{ t: '2005-02', v: 71 },
		{ t: '2026-09', v: 105 }
	];
	it('reescala con el índice', () => {
		const r = realValue(1000, index, '2005-01')!;
		expect(r.value).toBeCloseTo(1500);
		expect(r.inflation).toBeCloseTo(50);
		expect(r.to.t).toBe('2026-09');
	});
	it('si falta el mes, toma el siguiente que haya (hasta un año)', () => {
		expect(realValue(1000, index.slice(1), '2005-01')!.from.t).toBe('2005-02');
		expect(realValue(1000, index, '1990-01')).toBeNull();
	});
});
