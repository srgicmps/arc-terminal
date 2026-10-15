import { describe, expect, it } from 'vitest';
import { epuSeries, parseDailyEpu, parseGlobalEpu, rolling } from './uncertainty.ts';

describe('uncertainty', () => {
	it('lee la hoja del EPU mundial y salta la cita del final', () => {
		const cells = [
			['Year', 'Month', 'GEPU_current', 'GEPU_ppp'],
			[2026, 6, 282.7154703306027, 279.03],
			[2026, 7, 241.6904910005747, 236.25],
			['Citation: Davis, Steven J., 2016.']
		];
		expect(parseGlobalEpu(cells)).toEqual([
			{ t: '2026-06', v: 282.7154703306027 },
			{ t: '2026-07', v: 241.6904910005747 }
		]);
		expect(parseGlobalEpu([['otra cosa']])).toEqual([]);
	});

	it('lee el CSV diario y lo ordena', () => {
		const csv = 'day,month,year,daily_policy_index\n13,10,2026,216.72\n12,10,2026,248.05\n\n';
		expect(parseDailyEpu(csv)).toEqual([
			{ t: '2026-10-12', v: 248.05 },
			{ t: '2026-10-13', v: 216.72 }
		]);
	});

	it('calcula la media móvil', () => {
		const pts = [1, 2, 3, 4].map((v, i) => ({ t: `d${i}`, v }));
		expect(rolling(pts, 2)).toEqual([
			{ t: 'd1', v: 1.5 },
			{ t: 'd2', v: 2.5 },
			{ t: 'd3', v: 3.5 }
		]);
	});

	it('monta las series y omite las que faltan', () => {
		expect(epuSeries([{ t: '2026-07', v: 241 }], []).map((s) => s.id)).toEqual(['epu-global']);
	});
});
