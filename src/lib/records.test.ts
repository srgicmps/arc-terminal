import { describe, expect, it } from 'vitest';
import { recordLabel, seriesRecord, yearsOf } from './records.ts';
import type { Point } from './types.ts';

/** Serie mensual desde enero de 2023 con los valores dados. */
const monthly = (values: number[]): Point[] =>
	values.map((v, i) => ({ t: `${2023 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`, v }));

describe('récords', () => {
	it('lee los periodos', () => {
		expect(yearsOf('2026-01')).toBe(2026);
		expect(yearsOf('2026-Q3')).toBe(2026.5);
		expect(yearsOf('2026-W01')).toBe(2026);
	});

	it('mínimo de toda la historia guardada', () => {
		const r = seriesRecord(monthly([...Array(35).fill(10), 9]));
		expect(r).toEqual({ kind: 'min', since: null, years: 2 });
		expect(recordLabel(r!)).toBe('mín. en 2 años');
	});

	it('máximo desde el último dato que lo igualó', () => {
		const r = seriesRecord(monthly([12, ...Array(33).fill(10), 11, 12]));
		expect(r).toEqual({ kind: 'max', since: 2023, years: 2 });
		expect(recordLabel(r!)).toBe('máx. desde 2023');
	});

	it('nada si cubre menos de 2 años o el dato anterior ya era igual', () => {
		expect(seriesRecord(monthly([...Array(20).fill(10), 9]))).toBeNull();
		expect(seriesRecord(monthly([...Array(34).fill(10), 9, 9]))).toBeNull();
		expect(seriesRecord(monthly([...Array(30).fill(10), 5, 10, 7]))).toBeNull();
	});
});
