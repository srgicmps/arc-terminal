import { describe, expect, it } from 'vitest';
import { duePeers, toPeers } from '../../scripts/sources/peers.ts';
import { compareWithPeers, median, toMetrics, type Metrics } from './rv.ts';

const m = (o: Partial<Metrics>): Metrics => ({
	pe: null, pb: null, ps: null, divYield: null, roe: null, margin: null, revGrowth: null, epsGrowth: null,
	beta: null, cap: null, high52: null, low52: null, high52Date: null, low52Date: null, ...o
});

describe('RV: cifras de Finnhub', () => {
	it('elige la primera clave con número y redondea', () => {
		const out = toMetrics({ metric: { peBasicExclExtraTTM: 31.456, netProfitMarginTTM: 55.1, '52WeekHigh': 212.2, '52WeekHighDate': '2026-08-14', beta: 'x' } });
		expect(out).toMatchObject({ pe: 31.46, margin: 55.1, high52: 212.2, high52Date: '2026-08-14', beta: null });
	});

	it('null si no trae nada', () => {
		expect(toMetrics({ metric: {} })).toBeNull();
		expect(toMetrics(null)).toBeNull();
	});
});

describe('RV: frente a sus competidores', () => {
	const metrics = { NVDA: m({ pe: 40, margin: 55 }), AMD: m({ pe: 80, margin: 10 }), INTC: m({ pe: -5, margin: -20 }), AVGO: m({ pe: 60, margin: 30 }) };

	it('mediana', () => {
		expect(median([3, 1, 2])).toBe(2);
		expect(median([1, 2, 3, 4])).toBe(2.5);
		expect(median([])).toBeNull();
	});

	it('PER: sin los negativos; menos es mejor', () => {
		const { rows, peers } = compareWithPeers('NVDA', ['NVDA', 'AMD', 'INTC', 'AVGO', 'QCOM'], metrics);
		expect(peers).toEqual(['AMD', 'INTC', 'AVGO']);
		const pe = rows.find((r) => r.key === 'pe')!;
		expect(pe).toMatchObject({ value: 40, median: 70, rank: 1, of: 3, better: true });
		const margin = rows.find((r) => r.key === 'margin')!;
		expect(margin).toMatchObject({ value: 55, median: 10, rank: 1, of: 4, better: true });
	});

	it('sin cifras propias no hay puesto', () => {
		const { rows } = compareWithPeers('QCOM', ['AMD'], metrics);
		expect(rows[0]).toMatchObject({ value: null, rank: null, better: null });
	});
});

describe('RV: competidores de Finnhub', () => {
	it('quita el propio valor y los repetidos', () => {
		expect(toPeers('NVDA', ['NVDA', 'AMD', 'amd', 'AVGO', 3])).toEqual(['AMD', 'AVGO']);
		expect(toPeers('NVDA', { error: 'x' })).toEqual([]);
	});

	it('refresca los que no tiene o tienen más de una semana, los más viejos primero', () => {
		const now = Date.parse('2026-10-15T00:00:00Z');
		const prev = { symbols: { A: { peers: [], fetchedAt: '2026-10-14T00:00:00Z' }, B: { peers: [], fetchedAt: '2026-10-01T00:00:00Z' } } };
		expect(duePeers(['A', 'B', 'C'], prev, now)).toEqual(['C', 'B']);
		expect(duePeers(['A', 'B', 'C'], prev, now, 1)).toEqual(['C']);
	});
});
