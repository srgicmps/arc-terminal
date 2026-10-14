import { describe, expect, it } from 'vitest';
import { curveRow, dayAt, daysBefore, tenor } from './curves.ts';
import type { YieldCurveData } from './types.ts';

const curve: YieldCurveData = {
	tenors: ['2A', '10A'],
	days: [
		{ date: '2025-10-13', values: [3.5, 4.0] },
		{ date: '2026-10-05', values: [3.9, 4.3] },
		{ date: '2026-10-07', values: [3.95, 4.25] },
		{ date: '2026-10-14', values: [4.0, 4.4] }
	]
};

describe('curvas de tipos', () => {
	it('resta días a una fecha, también cruzando meses y años', () => {
		expect(daysBefore('2026-10-14', 7)).toBe('2026-10-07');
		expect(daysBefore('2026-01-03', 7)).toBe('2025-12-27');
	});

	it('busca el último día publicado en o antes de la fecha', () => {
		expect(dayAt(curve, '2026-10-08')?.date).toBe('2026-10-07');
		expect(dayAt(curve, '2025-10-14')?.date).toBe('2025-10-13');
	});

	it('no compara con un día demasiado lejano (hueco en la historia)', () => {
		expect(dayAt(curve, '2026-06-01')).toBeNull();
		expect(dayAt(curve, '2020-01-01')).toBeNull();
	});

	it('lee un plazo y da null si no existe', () => {
		expect(tenor(curve, curve.days[0], '10A')).toBe(4.0);
		expect(tenor(curve, curve.days[0], '30A')).toBeNull();
		expect(tenor(curve, null, '10A')).toBeNull();
	});

	it('calcula la pendiente y la variación semanal del 10A en puntos básicos', () => {
		expect(curveRow(curve)).toEqual({ date: '2026-10-14', y2: 4.0, y10: 4.4, slope: 40, week10: 15 });
		expect(curveRow({ tenors: [], days: [] })).toBeNull();
	});
});
