import { describe, expect, it } from 'vitest';
import { gap, moneyRow, tenorSeries } from './btmm.ts';
import type { Series } from './types.ts';

const s = (id: string, points: [string, number][]): Series => ({ id, label: id, unit: '%', points: points.map(([t, v]) => ({ t, v })), source: 'x' });

describe('moneyRow', () => {
	it('cambio diario y mensual en pb, con el volumen del mismo día', () => {
		const sofr = s('sofr', [['2026-09-10', 4.1], ['2026-10-13', 4.3], ['2026-10-14', 4.31]]);
		const vol = s('vol', [['2026-10-14', 2500]]);
		expect(moneyRow(sofr, 'SOFR', vol)).toEqual({ id: 'sofr', label: 'SOFR', v: 4.31, t: '2026-10-14', d: 1, m: 21, vol: 2500 });
	});

	it('series mensuales: compara con el mes anterior', () => {
		const eur = s('euribor', [['2026-08', 2.1], ['2026-09', 2.05]]);
		expect(moneyRow(eur)).toMatchObject({ d: -5, m: -5 });
		expect(moneyRow(undefined)).toBeNull();
	});
});

describe('tenorSeries y gap', () => {
	it('saca un plazo de la curva sin huecos y resta en pb', () => {
		const curve = { tenors: ['1M', '3M'], days: [{ date: '2026-10-13', values: [4.2, null] }, { date: '2026-10-14', values: [4.25, 4.1] }] };
		expect(tenorSeries(curve, '3M', 'bill3m', 'Letra 3M')?.points).toEqual([{ t: '2026-10-14', v: 4.1 }]);
		expect(tenorSeries(curve, '1A', 'x', 'x')).toBeUndefined();
		const a = moneyRow(tenorSeries(curve, '1M', 'a', 'a'));
		const b = moneyRow(tenorSeries(curve, '3M', 'b', 'b'));
		expect(gap(a, b)).toBe(15);
	});
});
