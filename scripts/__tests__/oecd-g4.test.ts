import { afterEach, describe, expect, it, vi } from 'vitest';
import { oecdG4, parseG4, WANTED } from '../sources/oecd-g4.ts';
import { mockFetch } from './mock.ts';

afterEach(() => vi.unstubAllGlobals());

const [UNE, GDP] = WANTED;
const doc = (series_code: string, period: string[], value: (number | string)[]) => ({ series_code, period, value });

describe('oecd-g4', () => {
	it('da a cada país el id de Eurostat, se salta los «NA» y no inventa los que faltan', () => {
		const series = parseG4(UNE, {
			series: {
				docs: [
					doc('GBR.UNE_LF_M.PT_LF_SUB._Z.Y._T.Y_GE15._Z.M', ['2025-12', '2026-01'], [4.9, 5.1]),
					doc('JPN.UNE_LF_M.PT_LF_SUB._Z.Y._T.Y_GE15._Z.M', ['2026-03', '2026-04'], ['NA', 2.5])
				]
			}
		});
		expect(series.map((s) => [s.id, s.geo])).toEqual([
			['unemployment-gb', 'GB'],
			['unemployment-jp', 'JP']
		]);
		expect(series[1].points).toEqual([{ t: '2026-04', v: 2.5 }]);
	});

	it('lee los trimestres y guarda los últimos 12', () => {
		const periods = Array.from({ length: 14 }, (_, i) => `${2023 + Math.floor(i / 4)}-Q${(i % 4) + 1}`);
		const [us] = parseG4(GDP, { series: { docs: [doc('Q.Y.USA.S1.S1.B1GQ._Z._Z._Z.PC.L.G1.T0102', periods, periods.map(() => 0.5))] } });
		expect(us.id).toBe('gdp-us');
		expect(us.points).toHaveLength(12);
		expect(us.points.at(-1)!.t).toBe('2026-Q2');
	});

	it('pide los países juntos y, si falla un dataset, se queda con el otro', async () => {
		const urls: string[] = [];
		mockFetch((url) => {
			urls.push(url);
			if (url.includes('IALFS')) return new Response('caído', { status: 404 });
			return { series: { docs: [doc('Q.Y.CHN.S1.S1.B1GQ._Z._Z._Z.PC.L.G1.T0102', ['2026-Q1'], [1.2])] } };
		});
		const data = await oecdG4.fetch(undefined);
		expect(data.series.map((s) => s.id)).toEqual(['gdp-cn']);
		expect(urls.some((u) => u.includes('/Q.Y.USA+GBR+JPN+CHN.S1.'))).toBe(true);

		mockFetch(() => new Response('caído', { status: 404 }));
		await expect(oecdG4.fetch(undefined)).rejects.toThrow('ninguna serie');
	});
});
