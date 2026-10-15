import { describe, expect, it } from 'vitest';
import { uvWindow } from './weather.ts';
import { uvTodaySub } from './wx.ts';

describe('uvTodaySub', () => {
	it('con ventana, de qué hora a qué hora', () => {
		expect(uvTodaySub(6, { from: '13:00', to: '17:00' })).toBe('protégete de 13:00 a 17:00');
	});

	it('por la tarde, con UV alto al mediodía, no dice «no hace falta protegerse»', () => {
		// air.hours empieza en la hora actual (18:00): ya no queda ninguna hora con UV de 3 o más.
		const hours = [
			{ time: '2026-10-15T18:00', aqi: 30, uv: 0.4 },
			{ time: '2026-10-15T21:00', aqi: 30, uv: 0 },
			{ time: '2026-10-16T00:00', aqi: 30, uv: 0 }
		];
		const window = uvWindow(hours, '2026-10-15');
		expect(window).toBeNull();
		expect(uvTodaySub(6, window)).toBe('lo más fuerte ya ha pasado');
	});

	it('día flojo o sin dato', () => {
		expect(uvTodaySub(1.8, null)).toBe('no hace falta protegerse');
		expect(uvTodaySub(null, null)).toBe('no hace falta protegerse');
		expect(uvTodaySub(undefined, null)).toBe('no hace falta protegerse');
	});
});
