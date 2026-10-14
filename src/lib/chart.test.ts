import { describe, expect, it } from 'vitest';
import { axisTicks, periodChoices, periodDate, periodStart } from './chart.ts';

describe('axisTicks', () => {
	it('pone la primera y la última, y reparte las demás por igual', () => {
		expect(axisTicks(31, 600, 70)).toEqual([0, 4, 8, 11, 15, 19, 23, 26, 30]);
	});

	it('nunca deja dos etiquetas más cerca que minGap', () => {
		for (const count of [2, 5, 13, 30, 90, 365]) {
			for (const width of [150, 300, 600, 1200]) {
				const ticks = axisTicks(count, width, 64);
				const step = width / (count - 1);
				for (let k = 1; k < ticks.length; k++) {
					expect((ticks[k] - ticks[k - 1]) * step).toBeGreaterThanOrEqual(64 - step);
				}
				expect(ticks[0]).toBe(0);
				expect(ticks.at(-1)).toBe(count - 1);
			}
		}
	});

	it('con pocos puntos, todos llevan etiqueta si caben', () => {
		expect(axisTicks(3, 600, 70)).toEqual([0, 1, 2]);
		expect(axisTicks(1, 600, 70)).toEqual([0]);
		expect(axisTicks(0, 600, 70)).toEqual([]);
	});

	it('en un eje muy estrecho deja solo la primera y la última', () => {
		expect(axisTicks(30, 100, 70)).toEqual([0, 29]);
	});
});

describe('periodos', () => {
	it('lee los formatos del eje X', () => {
		expect(periodDate('2026-10-14')?.toISOString().slice(0, 10)).toBe('2026-10-14');
		expect(periodDate('2026-10')?.toISOString().slice(0, 10)).toBe('2026-10-01');
		expect(periodDate('2026-Q3')?.toISOString().slice(0, 10)).toBe('2026-07-01');
		expect(periodDate('2026')?.toISOString().slice(0, 10)).toBe('2026-01-01');
	});
	it('cuenta los meses desde el último dato', () => {
		expect(periodStart('2026-10-14', 3)?.toISOString().slice(0, 10)).toBe('2026-07-14');
	});
	it('solo ofrece periodos que recortan y dejan 3 puntos o más', () => {
		const days = Array.from({ length: 400 }, (_, i) => new Date(Date.UTC(2025, 8, 1 + i)).toISOString().slice(0, 10));
		expect(periodChoices(days).map((c) => c.label)).toEqual(['1M', '6M', '1A', 'Máx']);
		expect(periodChoices(['2026-08', '2026-09', '2026-10'])).toEqual([]);
	});
});
