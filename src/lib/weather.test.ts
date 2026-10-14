// Niveles (aire, UV, polen, mar), formatos del sol y fase de la luna.
import { describe, expect, it } from 'vitest';
import { aqiLevel, hoursMinutes, moon, pollenLevel, seaLevel, signedMinSec, uvLevel } from './weather.ts';

describe('niveles', () => {
	it('índice europeo de calidad del aire', () => {
		expect(aqiLevel(15)?.label).toBe('Bueno');
		expect(aqiLevel(34)).toEqual({ label: 'Razonable', tone: 'ok' });
		expect(aqiLevel(55)).toEqual({ label: 'Moderado', tone: 'mid' });
		expect(aqiLevel(72)?.tone).toBe('bad');
		expect(aqiLevel(130)?.label).toBe('Extremo');
		expect(aqiLevel(null)).toBeNull();
	});

	it('UV con los tramos de la OMS', () => {
		expect(uvLevel(2)?.label).toBe('Bajo');
		expect(uvLevel(5)?.label).toBe('Moderado');
		expect(uvLevel(7)?.label).toBe('Alto');
		expect(uvLevel(9)?.label).toBe('Muy alto');
		expect(uvLevel(11)?.label).toBe('Extremo');
	});

	it('polen con umbrales propios de cada tipo', () => {
		expect(pollenLevel('grass', 0.3)?.label).toBe('Nulo');
		expect(pollenLevel('grass', 30)?.label).toBe('Moderado');
		expect(pollenLevel('olive', 30)?.label).toBe('Bajo');
		expect(pollenLevel('olive', 250)?.label).toBe('Alto');
		expect(pollenLevel('olive', null)).toBeNull();
	});

	it('estado del mar (escala Douglas)', () => {
		expect(seaLevel(0.3)?.label).toBe('Marejadilla');
		expect(seaLevel(1)?.label).toBe('Marejada');
		expect(seaLevel(1.6)).toEqual({ label: 'Fuerte marejada', tone: 'mid' });
		expect(seaLevel(3)?.tone).toBe('bad');
	});
});

describe('sol', () => {
	it('duración del día y diferencia con ayer', () => {
		expect(hoursMinutes(39900)).toBe('11 h 05 min');
		expect(signedMinSec(92)).toBe('+1 min 32 s');
		expect(signedMinSec(-130.3)).toBe('−2 min 10 s');
		expect(signedMinSec(-40)).toBe('−40 s');
	});
});

describe('luna', () => {
	// Fases reales publicadas (UTC).
	it('acierta lunas llenas y nuevas conocidas', () => {
		const llena = moon(Date.UTC(2026, 0, 3, 10, 3));
		expect(llena.name).toBe('Luna llena');
		expect(llena.illumination).toBeGreaterThan(0.97);
		const nueva = moon(Date.UTC(2026, 0, 18, 19, 52));
		expect(nueva.name).toBe('Luna nueva');
		expect(nueva.illumination).toBeLessThan(0.03);
		expect(moon(Date.UTC(2024, 3, 23, 23, 49)).name).toBe('Luna llena');
	});

	it('cuarto creciente: mitad iluminada y creciendo', () => {
		const q = moon(Date.UTC(2026, 0, 26, 4, 47));
		expect(q.name).toBe('Cuarto creciente');
		expect(q.waxing).toBe(true);
		expect(q.illumination).toBeGreaterThan(0.4);
		expect(q.illumination).toBeLessThan(0.6);
	});
});
