import { describe, expect, it } from 'vitest';
import { SEP_IDS, sepTable } from './sep.ts';
import type { Series } from './types.ts';

const s = (id: string, points: [string, number][]): Series => ({
	id,
	label: id,
	unit: '%',
	source: 'FRED',
	url: `https://fred.stlouisfed.org/series/${id}`,
	points: points.map(([t, v]) => ({ t, v }))
});

describe('sepTable', () => {
	it('arma años, medianas y rangos; el largo plazo aparte', () => {
		const t = sepTable([
			s('sep-rate-md', [['2026', 3.6], ['2027', 3.4], ['2028', 3.1]]),
			s('sep-rate-lo', [['2026', 3.1], ['2027', 2.9], ['2028', 2.6]]),
			s('sep-rate-hi', [['2026', 3.9], ['2027', 3.9], ['2028', 3.9]]),
			s('sep-pce-md', [['2027', 2.4], ['2026', 3]]),
			s('sep-rate-lr', [['2026-09-17', 3]])
		])!;
		expect(t.years).toEqual(['2026', '2027', '2028']);
		expect(t.rows.map((r) => r.name)).toEqual(['Tipo de los fondos federales', 'Inflación PCE']);
		expect(t.rows[0].cells['2027']).toEqual({ md: 3.4, lo: 2.9, hi: 3.9 });
		// Sin series de rango, la celda lleva solo la mediana; y un año sin mediana no tiene celda.
		expect(t.rows[1].cells['2026']).toEqual({ md: 3, lo: null, hi: null });
		expect(t.rows[1].cells['2028']).toBeUndefined();
		expect(t.longRun).toBe(3);
	});

	it('los años del rango que no están en la mediana no salen', () => {
		const t = sepTable([s('sep-unrate-md', [['2026', 4.5]]), s('sep-unrate-hi', [['2026', 4.8], ['2029', 4.4]])])!;
		expect(t.years).toEqual(['2026']);
		expect(t.longRun).toBeUndefined();
	});

	it('quita los años ya pasados con fromYear', () => {
		const t = sepTable([s('sep-rate-md', [['2025', 4.4], ['2026', 3.6], ['2027', 3.4]])], 2026)!;
		expect(t.years).toEqual(['2026', '2027']);
	});

	it('sin medianas no hay tabla', () => {
		expect(sepTable([])).toBeNull();
		expect(sepTable([s('sep-rate-lo', [['2026', 3]]), s('sep-rate-lr', [['2026-09-17', 3]])])).toBeNull();
	});

	it('SEP_IDS lista las diez series', () => {
		expect(SEP_IDS).toHaveLength(10);
		expect(SEP_IDS).toContain('sep-pce-hi');
	});
});
