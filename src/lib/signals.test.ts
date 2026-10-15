import { describe, expect, it } from 'vitest';
import type { Metrics } from './rv.ts';
import { recentExtremes } from './signals.ts';

const m = (o: Partial<Metrics>): Metrics => ({
	pe: null, pb: null, ps: null, divYield: null, roe: null, margin: null, revGrowth: null, epsGrowth: null,
	beta: null, cap: null, high52: null, low52: null, high52Date: null, low52Date: null, ...o
});

describe('SIG: máximos y mínimos de 52 semanas', () => {
	const now = Date.parse('2026-10-15T12:00:00Z');
	const metrics = {
		NVDA: m({ high52: 230, high52Date: '2026-10-14', low52: 90, low52Date: '2026-01-02' }),
		AAPL: m({ high52: 260, high52Date: '2026-10-08' }),
		KO: m({ low52: 55, low52Date: '2026-10-15' }),
		OLD: m({ high52: 1, high52Date: '2026-09-01' })
	};

	it('solo los recientes, el más nuevo primero', () => {
		const { highs, lows } = recentExtremes(metrics, now);
		expect(highs.map((h) => [h.code, h.days])).toEqual([['NVDA', 1], ['AAPL', 7]]);
		expect(lows).toEqual([{ code: 'KO', price: 55, date: '2026-10-15', days: 0 }]);
	});

	it('el plazo se puede cambiar', () => {
		expect(recentExtremes(metrics, now, 3).highs.map((h) => h.code)).toEqual(['NVDA']);
	});
});
