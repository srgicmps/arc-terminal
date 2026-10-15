import { describe, expect, it } from 'vitest';
import { isRate, monthEnds, seasonality } from './seasonal.ts';

describe('monthEnds', () => {
	it('último valor de cada mes; ignora trimestres', () => {
		const m = monthEnds([{ t: '2026-01-31', v: 2 }, { t: '2026-01-02', v: 1 }, { t: '2026-02', v: 3 }, { t: '2026-Q1', v: 9 }]);
		expect([...m]).toEqual([['2026-01', 2], ['2026-02', 3]]);
	});
});

describe('seasonality', () => {
	it('precios: variación en % por mes y año, con media, mediana y años al alza', () => {
		const pts = ['2024-12', '2025-01', '2025-02', '2025-12', '2026-01'].map((t, i) => ({ t, v: [100, 110, 99, 100, 90][i] }));
		const s = seasonality(pts, 'USD')!;
		expect(s.mode).toBe('pct');
		expect(s.years.map((y) => y.year)).toEqual([2026, 2025]);
		expect(s.years[1].months[0]).toBeCloseTo(10);
		expect(s.years[0].months[0]).toBeCloseTo(-10);
		expect(s.months[0]).toMatchObject({ up: 1, n: 2 });
		expect(s.months[0].mean).toBeCloseTo(0);
		expect(s.months[1].n).toBe(1);
		expect(s).toMatchObject({ from: '2024-12', to: '2026-01', count: 3 });
	});

	it('tipos: diferencia; sin meses seguidos, null', () => {
		const s = seasonality([{ t: '2026-01-30', v: 4 }, { t: '2026-02-27', v: 4.25 }], '%')!;
		expect(s.mode).toBe('diff');
		expect(s.years[0].months[1]).toBeCloseTo(0.25);
		expect(seasonality([{ t: '2026-01', v: 1 }, { t: '2026-03', v: 2 }], '%')).toBeNull();
		expect(isRate('pb')).toBe(true);
		expect(isRate('M€')).toBe(false);
	});
});
