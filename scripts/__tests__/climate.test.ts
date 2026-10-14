// Fuente climate: si falla una parte opcional (el ONI de El Niño), se reutiliza la de la copia anterior.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { climate } from '../sources/climate.ts';
import { mockFetch } from './mock.ts';

afterEach(() => vi.unstubAllGlobals());

const CO2 = '# year, month, day, decimal, value\n2026,10,10,2026.7740,426.40\n';
const enso = { season: 'JAS', year: 2026, anom: 2.16, phase: 'nino' as const, streak: 3 };

describe('climate', () => {
	it('si el ONI no responde, vale el de la copia anterior', async () => {
		vi.spyOn(console, 'log').mockImplementation(() => {});
		mockFetch((url) => (url.includes('co2_daily') ? CO2 : undefined));
		const data = await climate.fetch({ temp: null, co2: null, enso });
		expect(data.enso).toEqual(enso);
		expect(data.co2?.ppm).toBe(426.4);
	});

	it('sin copia anterior, sin El Niño', async () => {
		vi.spyOn(console, 'log').mockImplementation(() => {});
		mockFetch((url) => (url.includes('co2_daily') ? CO2 : undefined));
		expect((await climate.fetch(undefined)).enso).toBeNull();
	});
});
