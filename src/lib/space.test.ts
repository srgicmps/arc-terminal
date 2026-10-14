import { describe, expect, it } from 'vitest';
import { gFromKp, stormLevel } from './space.ts';
import type { SwpcData } from './types.ts';

const base: SwpcData = { kp: 2.33, kpAt: null, kp24: [], g: 0, s: 0, r: 0, gForecast: 0, gForecastDate: null };

describe('stormLevel', () => {
	it('sin datos, null', () => {
		expect(stormLevel(null)).toBeNull();
		expect(stormLevel(undefined)).toBeNull();
	});

	it('el Kp equivale a una G (Kp 5 = G1 … Kp 9 = G5)', () => {
		expect([4.67, 5, 6.33, 7, 8.67, 9].map(gFromKp)).toEqual([0, 1, 2, 3, 4, 5]);
		expect(gFromKp(null)).toBe(0);
	});

	it('toma lo más alto entre ahora y la previsión', () => {
		expect(stormLevel(base)).toEqual({ level: 0, now: 0, forecast: 0, forecastDate: null, upcoming: false });
		expect(stormLevel({ ...base, gForecast: 3, gForecastDate: '2026-10-16' })).toMatchObject({ level: 3, now: 0, upcoming: true });
		// La NOAA aún no ha subido la escala, pero el Kp ya marca G4.
		expect(stormLevel({ ...base, kp: 8, g: 2, gForecast: 3 })).toMatchObject({ level: 4, now: 4, upcoming: false });
		// Sin escalas (null), solo cuenta el Kp.
		expect(stormLevel({ ...base, kp: 7.33, g: null, gForecast: null })).toMatchObject({ level: 3, forecast: 0 });
	});
});
