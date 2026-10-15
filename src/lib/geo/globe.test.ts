import { describe, expect, it } from 'vitest';
import {
	clampLat,
	invert,
	isDark,
	landDots,
	lonDelta,
	parseRings,
	pick,
	pulseOf,
	rgbOf,
	rotate,
	styleOf,
	subsolar,
	uniqueIds,
	withAlpha,
	wrapLon,
	type GlobePoint
} from './globe.ts';

const pt = (id: string, lat: number, lon: number, r = 1): GlobePoint => ({
	id,
	layer: 'quakes',
	lat,
	lon,
	r,
	title: id,
	sub: '',
	url: ''
});

describe('globo', () => {
	it('el centro de la vista queda en el centro y de frente', () => {
		const q = rotate(40, -3, { lon: -3, lat: 40 });
		expect(q.x).toBeCloseTo(0);
		expect(q.y).toBeCloseTo(0);
		expect(q.z).toBeCloseTo(1);
	});

	it('el este va a la derecha, el norte arriba y la otra cara no se ve', () => {
		const v = { lon: 0, lat: 0 };
		expect(rotate(0, 30, v).x).toBeGreaterThan(0);
		expect(rotate(30, 0, v).y).toBeGreaterThan(0);
		expect(rotate(0, 180, v).z).toBeLessThan(0);
	});

	it('invertir devuelve el punto de partida', () => {
		const v = { lon: 20, lat: 35 };
		for (const [lat, lon] of [
			[10, 30],
			[50, -10],
			[-20, 60]
		]) {
			const q = rotate(lat, lon, v);
			const back = invert(q.x, q.y, v)!;
			expect(back.lat).toBeCloseTo(lat);
			expect(back.lon).toBeCloseTo(lon);
		}
		expect(invert(0.9, 0.9, v)).toBeNull();
	});

	it('longitudes y latitudes dentro de rango', () => {
		expect(wrapLon(190)).toBe(-170);
		expect(wrapLon(-190)).toBe(170);
		expect(clampLat(95)).toBe(80);
		expect(lonDelta(170, -170)).toBe(20);
	});

	it('la trama de tierra reparte los puntos por igual', () => {
		const all = landDots(() => true, 1000);
		expect(all).toHaveLength(1000);
		const north = landDots((lat) => lat > 0, 1000);
		expect(north.length).toBeGreaterThan(480);
		expect(north.length).toBeLessThan(520);
	});

	it('lee las costas del trazado de world.ts', () => {
		const rings = parseRings('M180,90L190,80L200,90ZM10,10L20,20Z');
		expect(rings).toHaveLength(2);
		expect(rings[0][0]).toEqual([0, 0]);
		expect(rings[0][1]).toEqual([10, 10]);
	});

	it('toca el punto visible más cercano, nunca uno de detrás', () => {
		const v = { lon: 0, lat: 0 };
		const pts = [pt('a', 0, 0), pt('b', 0, 5), pt('c', 0, 180)];
		expect(pick(pts, 0, 0, v, 200)?.id).toBe('a');
		const b = rotate(0, 5, v);
		expect(pick(pts, b.x * 200 + 3, 0, v, 200)?.id).toBe('b');
		expect(pick(pts, 150, 150, v, 200)).toBeNull();
	});

	it('las capas sin estilo propio se pintan igual', () => {
		expect(styleOf('travel').shape).toBe('diamond');
		expect(styleOf('nueva').shape).toBe('circle');
	});

	it('los ids no se repiten entre capas', () => {
		const a = { ...pt('n-1', 0, 0), layer: 'conflict' };
		const b = { ...pt('n-1', 1, 1), layer: 'maritime' };
		const ids = uniqueIds([a, b, a]).map((p) => p.id);
		expect(ids).toEqual(['conflict:n-1', 'maritime:n-1']);
	});

	it('el Sol está sobre Greenwich a las 12 UTC y al norte en junio', () => {
		const s = subsolar(new Date('2026-06-21T12:00:00Z'));
		expect(s.lon).toBeCloseTo(0);
		expect(s.lat).toBeGreaterThan(23);
		expect(subsolar(new Date('2026-12-21T18:00:00Z')).lat).toBeLessThan(-23);
		expect(subsolar(new Date('2026-12-21T18:00:00Z')).lon).toBeCloseTo(-90);
	});

	it('lee colores del navegador y les pone transparencia', () => {
		expect(rgbOf('rgb(255, 176, 0)')).toEqual([255, 176, 0]);
		expect(rgbOf('color(srgb 1 0.5 0)')).toEqual([255, 128, 0]);
		expect(withAlpha('rgb(10, 20, 30)', 0.5)).toBe('rgba(10, 20, 30, 0.5)');
		expect(isDark('rgb(12, 12, 14)')).toBe(true);
		expect(isDark('rgb(245, 245, 240)')).toBe(false);
	});

	it('late más lo grave', () => {
		expect(pulseOf({ layer: 'straits', strong: true })).toBe(2);
		expect(pulseOf({ layer: 'quakes' })).toBe(1);
		expect(pulseOf({ layer: 'straits' })).toBe(0);
		expect(pulseOf({ layer: 'straits' }, true)).toBe(1);
	});
});
