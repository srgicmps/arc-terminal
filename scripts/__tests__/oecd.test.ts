import { describe, expect, it } from 'vitest';
import { oecd, parseDbnomics, parseOecd } from '../sources/oecd.ts';
import { mockFetch } from './mock.ts';

// CSV con la forma de la API SDMX de la OCDE (format=csvfile, dimensionAtObservation=AllDimensions).
const csv = (rows: [string, string, string, string][]) =>
	'STRUCTURE,STRUCTURE_ID,ACTION,REF_AREA,FREQ,METHODOLOGY,MEASURE,UNIT_MEASURE,EXPENDITURE,ADJUSTMENT,TRANSFORMATION,TIME_PERIOD,OBS_VALUE\r\n' +
	rows.map(([a, m, t, v]) => `DATAFLOW,OECD.SDD.TPS:DSD_G20_PRICES@DF_G20_PRICES(1.0),I,${a},M,${m},CPI,PA,_T,N,GY,${t},${v}`).join('\r\n') +
	'\r\n';

// Respuesta de DBnomics (/v22/series): una serie por país con periodos y valores en listas paralelas.
const doc = (area: string, period: string[], value: (number | string)[], methodology = 'N') => ({
	dimensions: { REF_AREA: area, FREQ: 'M', METHODOLOGY: methodology, MEASURE: 'CPI', TRANSFORMATION: 'GY' },
	period,
	value
});

const tenAreas = ['G20', 'USA', 'CHN', 'JPN', 'DEU', 'FRA', 'ITA', 'GBR', 'IND', 'BRA'];

describe('parseOecd', () => {
	it('agrupa por país, ordena por mes y prefiere la metodología nacional', () => {
		const byArea = parseOecd(
			csv([
				['FRA', 'HICP', '2026-08', '1.4'],
				['FRA', 'N', '2026-09', '1.1'],
				['FRA', 'N', '2026-08', '1.2'],
				['USA', 'N', '2026-09', '2.9'],
				['ESP', 'N', '2026-09', '3.0'],
				['USA', 'N', '2026-Q3', '2.8'],
				['USA', 'N', '2026-08', '']
			])
		);
		expect(byArea.get('FRA')).toEqual([
			{ t: '2026-09', v: 1.1 },
			{ t: '2026-08', v: 1.2 }
		]);
		expect(byArea.get('USA')).toEqual([{ t: '2026-09', v: 2.9 }]);
		// Fuera del G20, trimestres y huecos se descartan.
		expect(byArea.has('ESP')).toBe(false);
	});
});

describe('parseDbnomics', () => {
	it('lee periodos y valores, salta «NA» y se queda con los 13 últimos meses', () => {
		const months = Array.from({ length: 20 }, (_, i) => `2025-${String((i % 12) + 1).padStart(2, '0')}`);
		const byArea = parseDbnomics({
			series: {
				docs: [
					doc('G20', ['2026-07', '2026-08', '2026-09'], [3.1, 'NA', 3.3]),
					doc('JPN', months, months.map((_, i) => i)),
					doc('XXX', ['2026-09'], [1])
				]
			}
		});
		expect(byArea.get('G20')).toEqual([
			{ t: '2026-07', v: 3.1 },
			{ t: '2026-09', v: 3.3 }
		]);
		expect(byArea.get('JPN')).toHaveLength(13);
		expect(byArea.has('XXX')).toBe(false);
	});

	it('si un país trae dos metodologías, gana la nacional aunque venga después', () => {
		const byArea = parseDbnomics({
			series: { docs: [doc('ITA', ['2026-09'], [2.0], 'HICP'), doc('ITA', ['2026-09'], [1.8], 'N')] }
		});
		expect(byArea.get('ITA')).toEqual([{ t: '2026-09', v: 1.8 }]);
	});
});

describe('oecd', () => {
	it('usa la OCDE si responde con suficientes países, con el G20 primero', async () => {
		const fetch = mockFetch((url) =>
			url.includes('sdmx.oecd.org') ? csv(tenAreas.map((a, i) => [a, 'N', '2026-09', String(i)])) : undefined
		);
		const data = await oecd.fetch(undefined);
		expect(data.via).toBe('oecd');
		// En el orden de AREAS: el G20 primero y luego los países.
		expect(data.series.map((s) => s.id).slice(0, 3)).toEqual(['g20cpi-g20', 'g20cpi-bra', 'g20cpi-chn']);
		expect(data.series.find((s) => s.id === 'g20cpi-usa')).toMatchObject({
			label: 'EE. UU.',
			unit: '%',
			source: 'OCDE',
			points: [{ t: '2026-09', v: 1 }]
		});
		expect(fetch).toHaveBeenCalledTimes(1);
		expect(String(fetch.mock.calls[0][0])).toContain('/.M..CPI.PA._T.N.GY?startPeriod=');
	});

	// Los fallos se simulan con un 404, que request() no reintenta (un 500 lo reintentaría con esperas).
	it('si la OCDE falla, usa DBnomics y lo dice', async () => {
		mockFetch((url) => {
			if (url.includes('sdmx.oecd.org')) return new Response('no encontrado', { status: 404 });
			if (url.includes('db.nomics.world')) return { series: { docs: [doc('G20', ['2026-09'], [3.3]), doc('ARG', ['2026-09'], [30])] } };
		});
		const data = await oecd.fetch(undefined);
		expect(data.via).toBe('dbnomics');
		expect(data.series.map((s) => s.label)).toEqual(['G20', 'Argentina']);
		expect(data.series[0].source).toBe('OCDE vía DBnomics');
	});

	it('descarta los países que dejaron de publicar (último dato con más de un año de retraso)', async () => {
		mockFetch((url) =>
			url.includes('db.nomics.world')
				? { series: { docs: [doc('G20', ['2026-04'], [4.2]), doc('RUS', ['2022-02'], [9.2]), doc('TUR', ['2025-12'], [30])] } }
				: undefined
		);
		const data = await oecd.fetch(undefined);
		expect(data.series.map((s) => s.label)).toEqual(['G20', 'Turquía']);
	});

	it('falla si ninguna de las dos responde', async () => {
		mockFetch(() => undefined);
		await expect(oecd.fetch(undefined)).rejects.toThrow(/ni la OCDE ni DBnomics/);
	});
});
