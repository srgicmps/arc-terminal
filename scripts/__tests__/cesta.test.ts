import { describe, expect, it } from 'vitest';
import { build, cell, type JsonStat } from '../sources/cesta.ts';

const stat = (coicop: string[], time: string[], values: (number | null)[]): JsonStat => ({
	id: ['freq', 'unit', 'coicop18', 'geo', 'time'],
	size: [1, 1, coicop.length, 1, time.length],
	dimension: {
		coicop18: { category: { index: Object.fromEntries(coicop.map((c, i) => [c, i])) } },
		time: { category: { index: Object.fromEntries(time.map((t, i) => [t, i])) } }
	},
	value: Object.fromEntries(values.flatMap((v, i) => (v === null ? [] : [[String(i), v]])))
});

describe('cesta (Eurostat)', () => {
	it('lee la celda por códigos', () => {
		const s = stat(['TOTAL', 'CP01'], ['2026-08', '2026-09'], [1, 2, 3, 4]);
		expect(cell(s, { coicop18: 'CP01', time: '2026-08' })).toBe(3);
		expect(cell(s, { coicop18: 'CP99', time: '2026-08' })).toBeNull();
	});

	it('junta índice, tasas y pesos', () => {
		const index = stat(['TOTAL'], ['2005-01', '2026-09'], [70, 105]);
		const rates = stat(['TOTAL', 'CP01', 'CP07'], ['2026-09'], [3, 2.7, null]);
		const weights = stat(['CP01', 'CP07'], ['2026'], [169.5, 120]);
		const d = build(index, rates, weights);
		expect(d.index.points).toEqual([{ t: '2005-01', v: 70 }, { t: '2026-09', v: 105 }]);
		expect(d.total).toBe(3);
		expect(d.month).toBe('2026-09');
		expect(d.weightsYear).toBe('2026');
		expect(d.groups.find((g) => g.code === 'CP01')).toMatchObject({ weight: 169.5, rate: 2.7 });
		expect(d.groups.find((g) => g.code === 'CP07')).toMatchObject({ weight: 120, rate: null });
		expect(d.groups).toHaveLength(13);
	});
});
