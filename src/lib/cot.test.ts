import { describe, expect, it } from 'vitest';
import { parseCot, type CotRow } from './cot.ts';

const row = (t: string, code: string, long: number, short: number, oi = 1000): CotRow => ({
	report_date_as_yyyy_mm_dd: `${t}T00:00:00.000`,
	cftc_contract_market_code: code,
	open_interest_all: String(oi),
	noncomm_positions_long_all: String(long),
	noncomm_positions_short_all: String(short)
});

describe('cot', () => {
	it('calcula la neta, su peso, el cambio semanal y el rango de un año', () => {
		// 30 semanas de oro con la neta subiendo de 0 a 290; la última, la más alta.
		const rows = Array.from({ length: 30 }, (_, i) => {
			const d = new Date(Date.UTC(2026, 0, 6 + i * 7)).toISOString().slice(0, 10);
			return row(d, '088691', 300 + i * 10, 300);
		});
		const data = parseCot(rows.reverse());
		expect(data?.date).toBe('2026-07-28');
		expect(data?.markets).toEqual([{ code: '088691', name: 'Oro', net: 290, pctOi: 29, change: 10, range: 100 }]);
	});

	it('sin historia suficiente no da rango, y se salta los mercados sin el último informe', () => {
		const data = parseCot([
			row('2026-10-06', '099741', 100, 300, 2000),
			row('2026-09-29', '099741', 150, 300, 2000),
			row('2026-09-29', '097741', 500, 100)
		]);
		expect(data?.markets).toEqual([{ code: '099741', name: 'Euro', net: -200, pctOi: -10, change: -50, range: null }]);
	});

	it('null si no hay filas', () => {
		expect(parseCot([])).toBeNull();
	});
});
