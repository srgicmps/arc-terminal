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
const hours = Array.from({ length: 13 }, (_, i) => new Date(Date.UTC(2026, 9, 13, i * 3)).toISOString().slice(0, 19));
const kps = [1.33, 2, 2.67, 3, 4.33, 5, 6.67, 7.33, 6, 5.33, 4, 3.67, 2.33];

/** Forma real (comprobada en la Action del PR, oct. 2026): lista de objetos, fecha sin zona y Kp numérico. */
const kpObjects = hours.map((t, i) => ({ time_tag: t, Kp: kps[i], a_running: 15, station_count: 8 }));
/** Forma antigua: tabla en arrays, primera fila de cabecera, todo en texto («2026-10-13 00:00:00.000»). */
const kpArrays = [
	['time_tag', 'Kp', 'a_running', 'station_count'],
	...hours.map((t, i) => [`${t.replace('T', ' ')}.000`, kps[i].toFixed(2), '15', '8'])
];

/** Un día de noaa-scales.json tal como llega: escalas en texto; en la previsión, R y S sin escala (null). */
const day = (date: string, time: string, g: string, now = false) => ({
	DateStamp: date,
	TimeStamp: time,
	R: now ? { Scale: '1', Text: 'minor', MinorProb: null, MajorProb: null } : { Scale: null, Text: null, MinorProb: '20', MajorProb: '5' },
	S: now ? { Scale: '0', Text: 'none', Prob: null } : { Scale: null, Text: null, Prob: '5' },
	G: { Scale: g, Text: g === '0' ? 'none' : 'minor' }
});
/** Mismo orden de claves que la respuesta real: "0" (ahora), "1" (resto de hoy), "2", "3" y "-1" (ayer). */
const scales = {
	'0': day('2026-10-14', '13:45:00', '1', true),
	'1': day('2026-10-14', '13:45:00', '2'),
	'2': day('2026-10-15', '00:00:00', '3'),
	'3': day('2026-10-16', '00:00:00', '1'),
	'-1': day('2026-10-13', '13:45:00', '3', true)
};

describe('swpc', () => {
	it('lee las fechas de la NOAA (UTC sin zona)', () => {
		expect(swpcTime('2026-10-14 09:00:00.000')).toBe('2026-10-14T09:00:00.000Z');
		expect(swpcTime('2026-10-14T09:00:00')).toBe('2026-10-14T09:00:00.000Z'); // forma actual
		expect(swpcTime('time_tag')).toBeNull();
	});

	it('lee el Kp igual en arrays con cabecera que en objetos', () => {
		const a = parseKp(kpObjects);
		expect(a).toHaveLength(13);
		expect(a[0]).toEqual({ t: '2026-10-13T00:00:00.000Z', v: 1.33 });
		expect(parseKp(kpArrays)).toEqual(a);
		// Sin cabecera, se supone [fecha, Kp, …].
		expect(parseKp(kpArrays.slice(1))).toEqual(a);
		// Filas rotas o fuera de rango: fuera.
		expect(parseKp([['time_tag', 'Kp'], ['2026-10-14 00:00:00.000', ''], ['basura', '3'], ['2026-10-14 03:00:00.000', '12']])).toEqual([]);
		expect(parseKp({ error: 'x' })).toEqual([]);
	});

	it('lee las escalas actuales y la G más alta prevista', () => {
		expect(parseScales(scales)).toEqual({ g: 1, s: 0, r: 1, gForecast: 3, gForecastDate: '2026-10-15' });
		// Forma plana con «G.Scale» y valores numéricos o vacíos.
		expect(parseScales({ '0': { 'G.Scale': 4, 'S.Scale': null, 'R.Scale': '2' }, '1': { 'G.Scale': '5', DateStamp: '2026-10-15' } })).toEqual({
			g: 4,
			s: null,
			r: 2,
			gForecast: 5,
			gForecastDate: '2026-10-15'
		});
		// Respuesta real de un día tranquilo: todo G0, sin fecha de previsión.
		const calm = Object.fromEntries(Object.entries(scales).map(([k, d]) => [k, { ...d, G: { Scale: '0', Text: 'none' } }]));
		expect(parseScales(calm)).toMatchObject({ g: 0, gForecast: 0, gForecastDate: null });
		expect(parseScales(null)).toEqual({ g: null, s: null, r: null, gForecast: null, gForecastDate: null });
	});

	it('guarda el Kp actual, las últimas 24 h y las escalas', async () => {
		mockFetch((url) => (url.endsWith('/noaa-planetary-k-index.json') ? kpObjects : url.endsWith('/noaa-scales.json') ? scales : undefined));
		const data = await swpc.fetch(undefined);
		expect(data.kp).toBe(2.33);
		expect(data.kpAt).toBe('2026-10-14T12:00:00.000Z');
		// 24 h hacia atrás desde la última medida: de las 15:00 del 13 a las 12:00 del 14.
		expect(data.kp24.map((p) => p.v)).toEqual([5, 6.67, 7.33, 6, 5.33, 4, 3.67, 2.33]);
		expect(data).toMatchObject({ g: 1, s: 0, r: 1, gForecast: 3, gForecastDate: '2026-10-15' });
	});

	it('sin escalas sigue (la G sale del Kp); sin Kp falla', async () => {
		mockFetch((url) => (url.endsWith('/noaa-planetary-k-index.json') ? kpArrays : undefined));
		const data = await swpc.fetch(undefined);
		expect(data).toMatchObject({ kp: 2.33, g: null, gForecast: null });

		mockFetch((url) => (url.endsWith('/noaa-scales.json') ? scales : []));
		await expect(swpc.fetch(undefined)).rejects.toThrow('sin datos de Kp');
	});
});
