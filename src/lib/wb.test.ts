import { describe, expect, it } from 'vitest';
import { wbRows } from './wb.ts';
import type { YieldCurveData } from './types.ts';

const curve: YieldCurveData = {
	tenors: ['2A', '10A', '30A'],
	days: [
		{ date: '2026-09-10', values: [3.5, 4.0, 4.5] },
		{ date: '2026-10-12', values: [3.6, 4.1, 4.6] },
		{ date: '2026-10-13', values: [3.7, 4.2, 4.7] },
		{ date: '2026-10-14', values: [null, null, null] }
	]
};

describe('wbRows', () => {
	it('toma el último día con 10 años y calcula cambios y pendientes en pb', () => {
		const [r] = wbRows([{ code: 'US', name: 'EE. UU.', curve }]);
		expect(r).toMatchObject({ date: '2026-10-13', y2: 3.7, y10: 4.2, y30: 4.7, d10: 10, m10: 20, s2s10: 50, s10s30: 50 });
	});

	it('sin plazo a 30 años deja «—» y quita las curvas que faltan', () => {
		const jp: YieldCurveData = { tenors: ['2A', '10A'], days: [{ date: '2026-10-14', values: [1, 1.5] }] };
		const rows = wbRows([{ code: 'JP', name: 'Japón', curve: jp }, { code: 'EA', name: 'Zona euro', curve: null }]);
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({ y30: null, s10s30: null, d10: null, m10: null, s2s10: 50 });
	});
});
