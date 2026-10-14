import { afterEach, describe, expect, it, vi } from 'vitest';
import { cboeDate, parseCloses, toCurve, vix } from '../sources/vix.ts';
import { mockFetch } from './mock.ts';

afterEach(() => vi.unstubAllGlobals());

const csv = (rows: [string, number][]) =>
	['DATE,OPEN,HIGH,LOW,CLOSE', ...rows.map(([d, v]) => `${d},1.000000,2.000000,0.500000,${v.toFixed(6)}`)].join('\n');

describe('vix', () => {
	it('lee las fechas de Cboe (mes/día/año) y el cierre', () => {
		expect(cboeDate('10/13/2026')).toBe('2026-10-13');
		expect(cboeDate('1/2/1990')).toBe('1990-01-02');
		expect(cboeDate('DATE')).toBeNull();
		expect([...parseCloses(csv([['10/12/2026', 15.21], ['10/13/2026', 15.27]]))]).toEqual([
			['2026-10-12', 15.21],
			['2026-10-13', 15.27]
		]);
		expect(parseCloses('FECHA,VALOR\n10/13/2026,1').size).toBe(0);
	});

	it('junta los plazos por día del VIX, con huecos donde falta alguno, y guarda los últimos 30', () => {
		const vixDays = new Map(Array.from({ length: 40 }, (_, i) => [`2026-08-${String(i + 1).padStart(2, '0')}`, 15 + i / 10]));
		const nine = new Map([['2026-08-40', 12]]);
		const curve = toCurve([nine, vixDays, new Map(), new Map(), new Map()]);
		expect(curve.tenors).toEqual(['9D', '1M', '3M', '6M', '1A']);
		expect(curve.days).toHaveLength(30);
		expect(curve.days.at(-1)).toEqual({ date: '2026-08-40', values: [12, 18.9, null, null, null] });
	});

	it('si falla un plazo sigue sin él; si falla el VIX, falla la fuente', async () => {
		mockFetch((url) => (url.includes('/VIX6M_') ? undefined : csv([['10/13/2026', url.includes('/VIX_') ? 15.27 : 20]])));
		const data = await vix.fetch(undefined);
		expect(data.days).toEqual([{ date: '2026-10-13', values: [20, 15.27, 20, null, 20] }]);

		mockFetch((url) => (url.includes('/VIX_') ? undefined : csv([['10/13/2026', 20]])));
		await expect(vix.fetch(undefined)).rejects.toThrow();
	});
});
