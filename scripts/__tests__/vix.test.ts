import { afterEach, describe, expect, it, vi } from 'vitest';
import { cboeDate, lastTwo, parseCloses, toCurve, vix } from '../sources/vix.ts';
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
		expect(parseCloses('DATE\n10/13/2026').size).toBe(0);
	});

	it('junta los plazos por día del VIX, con huecos donde falta alguno, y guarda los últimos 30', () => {
		const dates = Array.from({ length: 40 }, (_, i) => `2026-08-${String(i + 1).padStart(2, '0')}`);
		const full = (base: number) => new Map(dates.map((d, i) => [d, base + i / 10]));
		const nine = new Map([['2026-08-40', 12]]);
		const curve = toCurve([nine, full(15), full(18), full(20), new Map()]);
		expect(curve.tenors).toEqual(['9D', '1M', '3M', '6M', '1A']);
		expect(curve.days).toHaveLength(30);
		expect(curve.days.at(-1)).toEqual({ date: '2026-08-40', values: [12, 18.9, 21.9, 23.9, null] });
	});

	it('descarta los días con menos de 3 plazos (festivos de EE. UU. en que solo sale el VIX)', () => {
		const on = (pairs: [string, number][]) => new Map(pairs);
		const curve = toCurve([
			on([['2026-09-04', 12]]),
			on([['2026-09-04', 15], ['2026-09-07', 15.3]]),
			on([['2026-09-04', 18]]),
			on([['2026-09-04', 20]]),
			on([['2026-09-04', 21]])
		]);
		expect(curve.days.map((d) => d.date)).toEqual(['2026-09-04']);
	});

	it('si falla un plazo sigue sin él; si falla el VIX, falla la fuente', async () => {
		mockFetch((url) => (url.includes('/VIX6M_') ? undefined : csv([['10/13/2026', url.includes('/VIX_') ? 15.27 : 20]])));
		// Sin VIX6M quedan 4 plazos: el día vale.
		const data = await vix.fetch(undefined);
		expect(data.days).toEqual([{ date: '2026-10-13', values: [20, 15.27, 20, null, 20] }]);

		mockFetch((url) => (url.includes('/VIX_') ? undefined : csv([['10/13/2026', 20]])));
		await expect(vix.fetch(undefined)).rejects.toThrow();
	});

	it('lee los CSV de una sola columna (VVIX, SKEW) y da el último cierre con el anterior', () => {
		const closes = parseCloses('DATE,VVIX\n10/12/2026,92.5\n10/13/2026,95.1');
		expect(lastTwo(closes)).toEqual({ date: '2026-10-13', value: 95.1, previous: 92.5 });
		expect(lastTwo(new Map([['2026-10-13', 140]]))).toEqual({ date: '2026-10-13', value: 140, previous: null });
		expect(lastTwo(new Map())).toBeNull();
	});

	it('añade VVIX y SKEW; si fallan, la curva sale igual sin ellos', async () => {
		mockFetch((url) =>
			url.includes('/SKEW_') ? undefined : url.includes('/VVIX_') ? 'DATE,VVIX\n10/13/2026,95.1' : csv([['10/13/2026', 20]])
		);
		const data = await vix.fetch(undefined);
		expect(data.vvix).toEqual({ date: '2026-10-13', value: 95.1, previous: null });
		expect(data.skew).toBeNull();
		expect(data.days).toHaveLength(1);
	});
});
