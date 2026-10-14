// NOAA SWPC: índice Kp y escalas G, S y R. Muestras con la forma documentada de los dos productos.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseKp, parseScales, swpc, swpcTime } from '../sources/swpc.ts';
import { mockFetch } from './mock.ts';

beforeEach(() => {
	vi.useFakeTimers({ toFake: ['Date'] });
	vi.setSystemTime(new Date('2026-10-14T13:40:00Z'));
	vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => vi.useRealTimers());

/** Kp cada 3 h desde el 13/10 00:00 hasta el 14/10 12:00 (13 medidas). */
const hours = Array.from({ length: 13 }, (_, i) => {
	const d = new Date(Date.UTC(2026, 9, 13, i * 3));
	return d.toISOString().replace('T', ' ').replace('Z', '');
});
const kps = ['1.33', '2.00', '2.67', '3.00', '4.33', '5.00', '6.67', '7.33', '6.00', '5.33', '4.00', '3.67', '2.33'];

/** Forma clásica: tabla en arrays, primera fila de cabecera, todo en texto. */
const kpArrays = [['time_tag', 'Kp', 'a_running', 'station_count'], ...hours.map((t, i) => [t, kps[i], '15', '8'])];
/** Forma nueva: lista de objetos con números. */
const kpObjects = hours.map((t, i) => ({ time_tag: t.replace(' ', 'T'), Kp: Number(kps[i]), a_running: 15, station_count: 8 }));

const day = (date: string, g: string | null, s = '0', r = '0') => ({
	DateStamp: date,
	TimeStamp: '13:40:00',
	R: { Scale: r, Text: 'none', MinorProb: '25', MajorProb: '5' },
	S: { Scale: s, Text: 'none', Prob: '1' },
	G: { Scale: g, Text: 'none' }
});
const scales = {
	'-1': day('2026-10-13', '3'),
	'0': day('2026-10-14', '1', '0', '1'),
	'1': day('2026-10-15', '2'),
	'2': day('2026-10-16', '3'),
	'3': day('2026-10-17', '1')
};

describe('swpc', () => {
	it('lee las fechas de la NOAA (UTC sin zona)', () => {
		expect(swpcTime('2026-10-14 09:00:00.000')).toBe('2026-10-14T09:00:00.000Z');
		expect(swpcTime('2026-10-14T09:00:00')).toBe('2026-10-14T09:00:00.000Z');
		expect(swpcTime('time_tag')).toBeNull();
	});

	it('lee el Kp igual en arrays con cabecera que en objetos', () => {
		const a = parseKp(kpArrays);
		expect(a).toHaveLength(13);
		expect(a[0]).toEqual({ t: '2026-10-13T00:00:00.000Z', v: 1.33 });
		expect(parseKp(kpObjects)).toEqual(a);
		// Sin cabecera, se supone [fecha, Kp, …].
		expect(parseKp(kpArrays.slice(1))).toEqual(a);
		// Filas rotas o fuera de rango: fuera.
		expect(parseKp([['time_tag', 'Kp'], ['2026-10-14 00:00:00.000', ''], ['basura', '3'], ['2026-10-14 03:00:00.000', '12']])).toEqual([]);
		expect(parseKp({ error: 'x' })).toEqual([]);
	});

	it('lee las escalas actuales y la G más alta prevista', () => {
		expect(parseScales(scales)).toEqual({ g: 1, s: 0, r: 1, gForecast: 3, gForecastDate: '2026-10-16' });
		// Forma plana con «G.Scale» y valores numéricos o vacíos.
		expect(parseScales({ '0': { 'G.Scale': 4, 'S.Scale': null, 'R.Scale': '2' }, '1': { 'G.Scale': '5', DateStamp: '2026-10-15' } })).toEqual({
			g: 4,
			s: null,
			r: 2,
			gForecast: 5,
			gForecastDate: '2026-10-15'
		});
		expect(parseScales(null)).toEqual({ g: null, s: null, r: null, gForecast: null, gForecastDate: null });
	});

	it('guarda el Kp actual, las últimas 24 h y las escalas', async () => {
		mockFetch((url) => (url.endsWith('/noaa-planetary-k-index.json') ? kpArrays : url.endsWith('/noaa-scales.json') ? scales : undefined));
		const data = await swpc.fetch(undefined);
		expect(data.kp).toBe(2.33);
		expect(data.kpAt).toBe('2026-10-14T12:00:00.000Z');
		// 24 h hacia atrás desde la última medida: de las 15:00 del 13 a las 12:00 del 14.
		expect(data.kp24.map((p) => p.v)).toEqual([5, 6.67, 7.33, 6, 5.33, 4, 3.67, 2.33]);
		expect(data).toMatchObject({ g: 1, gForecast: 3, gForecastDate: '2026-10-16' });
	});

	it('sin escalas sigue (la G sale del Kp); sin Kp falla', async () => {
		mockFetch((url) => (url.endsWith('/noaa-planetary-k-index.json') ? kpObjects : undefined));
		const data = await swpc.fetch(undefined);
		expect(data).toMatchObject({ kp: 2.33, g: null, gForecast: null });

		mockFetch((url) => (url.endsWith('/noaa-scales.json') ? scales : []));
		await expect(swpc.fetch(undefined)).rejects.toThrow('sin datos de Kp');
	});
});
