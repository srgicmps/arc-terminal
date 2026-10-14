import { describe, expect, it, vi } from 'vitest';
import { ecb } from '../sources/ecb.ts';
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

describe('ecb.isStale', () => {
	it('descarga de nuevo una copia sin el balance del Eurosistema', () => {
		const series = (id: string) => ({ id, label: '', unit: '', points: [], source: 'BCE', url: '' });
		expect(ecb.isStale!({ series: [series('ecb-dfr')] })).toBe(true);
		expect(ecb.isStale!({ series: [series('ecb-dfr'), series('ecb-balance')] })).toBe(false);
	});
});
