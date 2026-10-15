import { describe, expect, it } from 'vitest';
import type { Series } from '../types.ts';
import { euriborFact, inflationFact, monthName, present } from './facts.ts';

const series = (points: [string, number][]): Series => ({ id: 'x', label: 'x', unit: '%', source: 'Eurostat', points: points.map(([t, v]) => ({ t, v })) });

describe('app Sencilla: tarjetas', () => {
	it('inflación: cifra, cambio contra el mes anterior y frase llana', () => {
		const f = inflationFact(series([['2026-07', 2.1], ['2026-08', 2.4]]))!;
		expect(f.value).toBe('2,4 %');
		expect(f.delta).toBeCloseTo(0.3);
		expect(f.change).toBe('+0,3 puntos desde julio');
		expect(f.phrase).toContain('las cosas cuestan un 2,4 % más');
		expect(f.spark).toEqual([2.1, 2.4]);
	});

	it('euríbor: contra hace un año', () => {
		const f = euriborFact(series([['2025-09', 2.6], ['2026-08', 2.2], ['2026-09', 2.2]]))!;
		expect(f.change).toBe('−0,40 puntos en un año');
		expect(f.explain).toBe('euribor');
	});

	it('sin dato no hay tarjeta', () => {
		expect(inflationFact(undefined)).toBeNull();
		expect(present([null, inflationFact(series([['2026-08', 1]]))])).toHaveLength(1);
	});

	it('nombre del mes', () => {
		expect(monthName('2026-08')).toBe('agosto');
		expect(monthName('2026-Q2')).toBe('T2 26');
	});
});
