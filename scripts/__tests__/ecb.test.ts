import { describe, expect, it, vi } from 'vitest';
import { eacurve, ecb } from '../sources/ecb.ts';
import { mockFetch } from './mock.ts';

// CSV con la forma de la API del BCE (format=csvdata&detail=dataonly), desordenado y con un hueco.
const csv = (rows: [string, string][]) =>
	'KEY,FREQ,TIME_PERIOD,OBS_VALUE\r\n' + rows.map(([t, v]) => `X,M,${t},${v}`).join('\r\n') + '\r\n';

describe('ecb', () => {
	it('lee cada serie del CSV, ordenada y sin valores vacíos', async () => {
		vi.spyOn(console, 'log').mockImplementation(() => {});
		const fetch = mockFetch((url) => {
			if (url.includes('/FM/B.U2.EUR.4F.KR.DFR.LEV?')) return csv([['2026-10-01', '2.00'], ['2026-09-01', '2.25'], ['2026-08-01', '']]);
			if (url.includes('/EXR/D.USD.EUR.SP00.A?')) return csv([['2026-10-13', '1.0921']]);
			return undefined;
		});
		const { series } = await ecb.fetch(undefined);
		expect(series.map((s) => s.id)).toEqual(['ecb-dfr', 'eurusd']);
		expect(series[0]).toEqual({
			id: 'ecb-dfr',
			label: 'Facilidad de depósito',
			unit: '%',
			geo: 'EA',
			points: [
				{ t: '2026-09-01', v: 2.25 },
				{ t: '2026-10-01', v: 2 }
			],
			source: 'BCE',
			url: 'https://data.ecb.europa.eu/data/datasets/FM/FM.B.U2.EUR.4F.KR.DFR.LEV'
		});
		const url = String(fetch.mock.calls.find((c) => String(c[0]).includes('/FM/B.U2'))![0]);
		expect(url).toContain('lastNObservations=500');
		expect(url).toContain('format=csvdata');
	});

	it('falla si no llega ninguna serie', async () => {
		vi.spyOn(console, 'log').mockImplementation(() => {});
		mockFetch(() => 'KEY,TIME_PERIOD,OBS_VALUE\n');
		await expect(ecb.fetch(undefined)).rejects.toThrow('ninguna serie del BCE');
	});
});

describe('eacurve', () => {
	it('junta los plazos de cada día en una fila, ordenada', async () => {
		const csv = [
			'KEY,FREQ,DATA_TYPE_FM,TIME_PERIOD,OBS_VALUE',
			'YC.B.U2.EUR.4F.G_N_A.SV_C_YM.SR_10Y,B,SR_10Y,2026-10-14,2.71',
			'YC.B.U2.EUR.4F.G_N_A.SV_C_YM.SR_2Y,B,SR_2Y,2026-10-14,1.98',
			'YC.B.U2.EUR.4F.G_N_A.SV_C_YM.SR_2Y,B,SR_2Y,2026-10-13,1.97',
			'YC.B.U2.EUR.4F.G_N_A.SV_C_YM.SR_3M,B,SR_3M,2026-10-13,'
		].join('\n');
		const fetch = mockFetch(() => csv);
		const data = await eacurve.fetch(undefined);
		expect(String(fetch.mock.calls[0][0])).toContain('/YC/B.U2.EUR.4F.G_N_A.SV_C_YM.SR_3M+SR_1Y+SR_2Y+SR_5Y+SR_10Y+SR_30Y?');
		expect(data.tenors).toEqual(['3M', '1A', '2A', '5A', '10A', '30A']);
		expect(data.days).toEqual([
			{ date: '2026-10-13', values: [null, null, 1.97, null, null, null] },
			{ date: '2026-10-14', values: [null, null, 1.98, null, 2.71, null] }
		]);
	});

	it('falla si la curva viene vacía', async () => {
		mockFetch(() => 'KEY,TIME_PERIOD,OBS_VALUE\n');
		await expect(eacurve.fetch(undefined)).rejects.toThrow('curva vacía');
	});
});
