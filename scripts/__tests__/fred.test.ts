// FRED: series macro de EE. UU. La clave va en la URL, así que nunca debe salir en un error.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fred } from '../sources/fred.ts';
import { mockFetch } from './mock.ts';

const KEY = 'clave-de-prueba-123';

beforeEach(() => {
	vi.useFakeTimers({ toFake: ['Date'] });
	vi.setSystemTime(new Date('2026-10-14T10:00:00Z'));
	vi.stubEnv('FRED_API_KEY', KEY);
});
afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllEnvs();
});

/** Forma real de /fred/series/observations: de la más reciente a la más antigua y con «.» en los huecos. */
const obs = (rows: [string, string][]) => ({
	realtime_start: '2026-10-14',
	units: 'lin',
	count: rows.length,
	observations: rows.map(([date, value]) => ({ realtime_start: '2026-10-14', realtime_end: '2026-10-14', date, value }))
});

const seriesOf = (url: string) => new URL(url).searchParams.get('series_id');

describe('fred', () => {
	it('lee cada serie, ordena los puntos y escribe el periodo según la frecuencia', async () => {
		const fetch = mockFetch((url) => {
			switch (seriesOf(url)) {
				case 'DFF':
					return obs([['2026-10-13', '4.33'], ['2026-10-12', '.'], ['2026-10-11', '4.33'], ['2026-10-10', '4.58']]);
				case 'PCEPILFE':
					return obs([['2026-08-01', '2.9'], ['2026-07-01', '2.8']]);
				case 'GDPC1':
					return obs([['2026-04-01', '3.1'], ['2026-01-01', '-0.5']]);
				case 'ICSA':
					return obs([['2026-10-04', '224000'], ['2026-09-27', '219500']]);
				default:
					return obs([['2026-10-13', '1']]);
			}
		});
		const { series } = await fred.fetch(undefined);
		const byId = Object.fromEntries(series.map((s) => [s.id, s]));
		expect(series).toHaveLength(9);

		// El hueco «.» se descarta y los puntos quedan de más antiguo a más reciente.
		expect(byId['fedfunds-us'].points).toEqual([
			{ t: '2026-10-10', v: 4.58 },
			{ t: '2026-10-11', v: 4.33 },
			{ t: '2026-10-13', v: 4.33 }
		]);
		expect(byId['fedfunds-us']).toMatchObject({ geo: 'US', unit: '%', source: 'FRED', url: 'https://fred.stlouisfed.org/series/DFF' });
		expect(byId['core-pce-us'].points.map((p) => p.t)).toEqual(['2026-07', '2026-08']);
		expect(byId['gdp-us'].points).toEqual([
			{ t: '2026-Q1', v: -0.5 },
			{ t: '2026-Q2', v: 3.1 }
		]);
		// Personas → miles, con un decimal.
		expect(byId['claims-us'].points.map((p) => p.v)).toEqual([219.5, 224]);

		// La URL pide la transformación y la clave.
		const pce = fetch.mock.calls.map((c) => new URL(String(c[0]))).find((u) => u.searchParams.get('series_id') === 'PCEPILFE')!;
		expect(pce.searchParams.get('units')).toBe('pc1');
		expect(pce.searchParams.get('api_key')).toBe(KEY);
		expect(pce.searchParams.get('limit')).toBe('36');
	});

	it('descarta valores nulos y series sin observaciones sin tumbar el resto', async () => {
		vi.spyOn(console, 'log').mockImplementation(() => {});
		mockFetch((url) => {
			switch (seriesOf(url)) {
				case 'DFF':
					return { observations: [{ date: '2026-10-13', value: null }, { date: '2026-10-12', value: '4.33' }] };
				case 'VIXCLS':
					return { error_code: 0 }; // sin «observations»
				case 'DCOILWTICO':
					return { observations: null };
				default:
					return obs([]);
			}
		});
		const { series } = await fred.fetch(undefined);
		expect(series.map((s) => s.id)).toEqual(['fedfunds-us']);
		expect(series[0].points).toEqual([{ t: '2026-10-12', v: 4.33 }]);
	});

	it('lanza un error si ninguna serie trae datos', async () => {
		vi.spyOn(console, 'log').mockImplementation(() => {});
		mockFetch(() => obs([]));
		await expect(fred.fetch(undefined)).rejects.toThrow('ninguna serie de FRED');
	});

	it('no deja la clave en los mensajes de error (HTTP 500)', async () => {
		vi.useFakeTimers();
		const log = vi.spyOn(console, 'log').mockImplementation(() => {});
		const fetch = mockFetch(() => new Response('Internal Server Error', { status: 500 }));
		const result = fred.fetch(undefined).catch((error: Error) => error);
		await vi.runAllTimersAsync();
		const error = await result;

		expect(error).toBeInstanceOf(Error);
		expect((error as Error).message).not.toContain(KEY);
		// Se ha llamado con la clave (3 intentos por serie)…
		expect(fetch).toHaveBeenCalledTimes(9 * 3);
		expect(String(fetch.mock.calls[0][0])).toContain(KEY);
		// …pero el registro de cada serie (que acaba en status.json) no la lleva, ni tampoco la URL con parámetros.
		const logged = log.mock.calls.map((c) => c.join(' '));
		expect(logged).toHaveLength(9);
		for (const line of logged) {
			expect(line).not.toContain(KEY);
			expect(line).not.toContain('api_key');
			expect(line).toContain('HTTP 500 en https://api.stlouisfed.org/fred/series/observations');
		}
	});

	it('tampoco deja la clave si el fallo es de red y el mensaje trae la URL', async () => {
		vi.useFakeTimers();
		const log = vi.spyOn(console, 'log').mockImplementation(() => {});
		const fetch = vi.fn(async (url: string) => {
			throw new Error(`fetch failed: ${url} (clave ${KEY})`);
		});
		vi.stubGlobal('fetch', fetch);
		const result = fred.fetch(undefined).catch((error: Error) => error);
		await vi.runAllTimersAsync();
		expect(((await result) as Error).message).not.toContain(KEY);
		for (const c of log.mock.calls) expect(c.join(' ')).not.toContain(KEY);
	});
});
