import { describe, expect, it } from 'vitest';
import { pollenPhrase, uvPhrase } from './plain.ts';
import { hasPollen, pollenHigh, uvWindow, type AirData } from './weather.ts';

const air = (pollen: Record<string, number | null>, uv: number[]): AirData => ({
	place: 'Madrid',
	now: { time: '2026-05-10T12:00', aqi: 20, pm25: 5, pm10: 10, o3: 50, no2: 10, uv: 5, pollen },
	hours: uv.map((v, h) => ({ time: `2026-05-10T${String(h).padStart(2, '0')}:00`, aqi: 20, uv: v })),
	days: [{ date: '2026-05-10', aqi: 30, uv: Math.max(...uv), pollen }]
});

describe('polen y UV (F2)', () => {
	it('pollenHigh: solo moderado o alto, del más fuerte al más flojo', () => {
		const a = air({ olive: 250, grass: 30, birch: 5, alder: null }, []);
		expect(pollenHigh(a.days[0]).map((p) => [p.name, p.level.label])).toEqual([
			['Olivo', 'Alto'],
			['Gramíneas', 'Moderado']
		]);
		expect(pollenHigh(undefined)).toEqual([]);
	});

	it('hasPollen: fuera de Europa CAMS no da polen', () => {
		expect(hasPollen(air({ olive: null }, []))).toBe(false);
		expect(hasPollen(air({ olive: 0 }, []))).toBe(true);
		expect(hasPollen(null)).toBe(false);
	});

	it('uvWindow: de la primera a la última hora con UV de 3 o más', () => {
		const uv = Array.from({ length: 24 }, (_, h) => (h >= 11 && h <= 16 ? 6 : 1));
		expect(uvWindow(air({}, uv).hours, '2026-05-10')).toEqual({ from: '11:00', to: '17:00' });
		expect(uvWindow(air({}, [1, 2]).hours, '2026-05-10')).toBeNull();
	});

	it('frases del modo Sencillo', () => {
		expect(uvPhrase(7, 'Alto', { from: '12:00', to: '17:00' })).toBe('El sol (índice UV) llega hoy a 7, alto: protégete de 12:00 a 17:00.');
		expect(uvPhrase(null, undefined, null)).toBeNull();
		const high = pollenHigh(air({ olive: 250, grass: 30 }, []).days[0]);
		expect(pollenPhrase('hoy', high)).toBe('Polen hoy: olivo alto y gramíneas moderado.');
		expect(pollenPhrase('mañana', [])).toBe('Mañana apenas habrá polen.');
	});
});
