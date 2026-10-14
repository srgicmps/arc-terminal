// FEWS NET: personas en fase IPC 3+ por país; el dato más reciente de cada uno, mejor la situación actual.
import { describe, expect, it } from 'vitest';
import { fewsUrl, parseFews } from '../sources/fewsnet.ts';

const NOW = Date.parse('2026-10-14T12:00:00Z');
const row = (code: string, from: string, scenario: string, low: number, high: number) => ({
	country: code === 'SO' ? 'Somalia' : 'Afghanistan',
	country_code: code,
	projection_start: from,
	projection_end: '2026-12-31',
	scenario_name: scenario,
	low_value: low,
	high_value: high,
	comparison_to_one_year_ago: 'Higher'
});

describe('fewsnet', () => {
	it('se queda con lo más reciente de cada país, mejor la situación actual, y nada que empiece en el futuro', () => {
		const out = parseFews(
			{
				results: [
					row('AF', '2026-02-01', 'Peak Needs', 10_000_000, 10_999_999),
					row('AF', '2026-08-01', 'Peak Needs', 9_000_000, 9_999_999),
					row('AF', '2026-08-01', 'Current Situation', 8_000_000, 8_999_999),
					row('AF', '2027-01-01', 'Most Likely', 1, 2),
					row('SO', '2026-06-01', 'Current Situation', 3_000_000, 3_499_999),
					{ country_code: 'XX', projection_start: 'mal', low_value: 1 }
				]
			},
			NOW
		);
		expect(out.map((r) => [r.code, r.from, r.scenario, r.high])).toEqual([
			['AF', '2026-08-01', 'Current Situation', 8_999_999],
			['SO', '2026-06-01', 'Current Situation', 3_499_999]
		]);
		expect(out[0].vsYear).toBe('Higher');
	});

	it('pide fase 3+ por país desde hace un año', () => {
		const p = new URL(fewsUrl(NOW)).searchParams;
		expect([p.get('phase'), p.get('unit_type'), p.get('start_date')]).toEqual(['3+', 'admin0', '2025-10-14']);
	});
});
