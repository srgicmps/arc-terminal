import { describe, expect, it } from 'vitest';
import { deficitByDate, parseMts } from './mts.ts';

// Filas con la forma de la API (valores en texto), como las de agosto de 2026.
const table1 = [
	{ record_date: '2026-08-31', src_line_nbr: '27', current_month_dfct_sur_amt: '1965591017473.53' },
	{ record_date: '2026-08-31', src_line_nbr: '14', current_month_dfct_sur_amt: '1775369189818.35' },
	{ record_date: '2026-07-31', src_line_nbr: '26', current_month_dfct_sur_amt: '1798816211853.03' },
	{ record_date: '2026-07-31', src_line_nbr: '14', current_month_dfct_sur_amt: '1775369189818.35' },
	{ record_date: '2025-08-31', src_line_nbr: '27', current_month_dfct_sur_amt: '1973000000000' },
	{ record_date: '2025-08-31', src_line_nbr: '14', current_month_dfct_sur_amt: '1817000000000' }
];
const customs = [
	{
		record_date: '2026-09-30',
		record_fiscal_year: '2026',
		current_fytd_gross_rcpt_amt: '310000000000',
		current_fytd_net_rcpt_amt: '180000000000'
	},
	{
		record_date: '2026-08-31',
		record_fiscal_year: '2026',
		current_fytd_gross_rcpt_amt: '292532803275.26',
		current_fytd_net_rcpt_amt: '167308212393.62',
		prior_fytd_gross_rcpt_amt: '171864661266.18',
		prior_fytd_net_rcpt_amt: 'null'
	}
];

describe('mts', () => {
	it('de cada mes se queda con el acumulado del año en curso, no con el del año anterior completo', () => {
		const d = deficitByDate(table1);
		expect(d.get('2026-08-31')).toBe(1965591017473.53);
		expect(d.get('2026-07-31')).toBe(1798816211853.03);
	});

	it('junta déficit y aranceles del último mes que tienen los dos', () => {
		// Septiembre solo tiene aranceles: se usa agosto.
		expect(parseMts(table1, customs)).toEqual({
			asOf: '2026-08-31',
			fiscalYear: 2026,
			deficit: 1965591017473.53,
			deficitPrior: 1973000000000,
			customsGross: 292532803275.26,
			customsNet: 167308212393.62,
			customsGrossPrior: 171864661266.18,
			customsNetPrior: null
		});
	});

	it('sin datos, null', () => {
		expect(parseMts([], customs)).toBeNull();
		expect(parseMts(table1, [])).toBeNull();
	});
});
