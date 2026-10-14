import { describe, expect, it } from 'vitest';
import { bis, housing } from '../sources/bis.ts';
import { mockFetch } from './mock.ts';

// CSV con la forma de la API del BIS (detail=dataonly): una fila por día y país, desordenado.
const csv = (rows: [string, string, string][]) =>
	'FREQ,REF_AREA,TIME_PERIOD,OBS_VALUE\r\n' + rows.map(([a, t, v]) => `D,${a},${t},${v}`).join('\r\n') + '\r\n';

describe('bis', () => {
	it('guarda solo los días en que cambia el tipo, por mes', async () => {
		const fetch = mockFetch(() =>
			csv([
				['US', '2026-09-18', '4.125'],
				['US', '2026-09-17', '4.375'],
				['US', '2026-09-16', '4.375'],
				['US', '2026-09-19', '4.125'],
				['XM', '2026-06-11', '2.00'],
				['XM', '2026-06-12', ''],
				['XM', '2026-07-01', '2.00']
			])
		);
		const { series } = await bis.fetch(undefined);
		expect(series.map((s) => s.id)).toEqual(['policy-us', 'policy-xm']);
		expect(series[0]).toMatchObject({
			label: 'EE. UU. · Fed',
			unit: '%',
			geo: 'US',
			points: [
				{ t: '2026-09', v: 4.375 },
				{ t: '2026-09', v: 4.125 }
			],
			source: 'BIS'
		});
		// La zona euro se guarda como EA y, sin cambios, queda con un solo punto fechado en el último dato.
		expect(series[1]).toMatchObject({ geo: 'EA', points: [{ t: '2026-07', v: 2 }] });
		const url = String(fetch.mock.calls[0][0]);
		expect(url).toContain('/WS_CBPOL/D.US+XM+');
		expect(url).toContain('format=csv');
	});

	it('falla si el BIS no devuelve nada', async () => {
		mockFetch(() => 'FREQ,REF_AREA,TIME_PERIOD,OBS_VALUE\r\n');
		await expect(bis.fetch(undefined)).rejects.toThrow('el BIS no devuelve tipos');
	});
});

describe('housing (BIS, precio de la vivienda)', () => {
	// detail=dataonly del dataset WS_SPP: FREQ, REF_AREA, VALUE (N/R), UNIT_MEASURE, TIME_PERIOD, OBS_VALUE.
	const spp = (rows: [string, string, string, string][]) =>
		'FREQ,REF_AREA,VALUE,UNIT_MEASURE,TIME_PERIOD,OBS_VALUE\r\n' +
		rows.map(([a, k, t, v]) => `Q,${a},${k},771,${t},${v}`).join('\r\n') +
		'\r\n';

	it('una serie nominal y otra real por zona, en el orden de la tabla y por trimestres', async () => {
		const fetch = mockFetch(() =>
			spp([
				['ES', 'N', '2026-Q2', '12.1'],
				['ES', 'N', '2026-Q1', '11.4'],
				['ES', 'R', '2026-Q2', '9.8'],
				['US', 'N', '2026-Q2', '1.9'],
				['US', 'R', '2026-Q2', ''],
				['XM', 'N', '2026-Q2', '4.0'],
				['XM', 'X', '2026-Q2', '1']
			])
		);
		const { series } = await housing.fetch(undefined);
		expect(String(fetch.mock.calls[0][0])).toContain('/WS_SPP/Q.US+XM+ES+');
		expect(series.map((s) => s.id)).toEqual(['house-n-us', 'house-n-xm', 'house-n-es', 'house-r-es']);
		expect(series[2]).toMatchObject({ label: 'España · nominal', geo: 'ES', unit: '%' });
		expect(series[2].points).toEqual([
			{ t: '2026-Q1', v: 11.4 },
			{ t: '2026-Q2', v: 12.1 }
		]);
		expect(series[1].geo).toBe('EA');
	});

	it('falla si no llega ningún dato', async () => {
		mockFetch(() => 'FREQ,REF_AREA,VALUE,UNIT_MEASURE,TIME_PERIOD,OBS_VALUE\r\n');
		await expect(housing.fetch(undefined)).rejects.toThrow('el BIS no devuelve precios de la vivienda');
	});
});
