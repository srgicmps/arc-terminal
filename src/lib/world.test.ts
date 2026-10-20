import { describe, expect, it } from 'vitest';
import { parseRings } from './geo/globe.ts';
import svg from './geo/land.svg?raw';
import { LAND } from './world.ts';

describe('contorno de los continentes (land.svg)', () => {
	it('world.ts saca el trazado entero del SVG', () => {
		expect(LAND.startsWith('M')).toBe(true);
		expect(LAND.length).toBeGreaterThan(50_000);
		expect(LAND.endsWith('Z')).toBe(true);
		// Solo órdenes de trazo y números: nada del marcado del SVG.
		expect(LAND).toMatch(/^[MLZ0-9.,-]+$/);
	});

	it('el SVG tiene lo que necesita <use href="…#land">', () => {
		// Un solo trazado, con el id que nombra LAND_HREF.
		expect(svg.match(/<path\b/g)).toHaveLength(1);
		expect(svg).toMatch(/<path id="land"/);
		// vector-effect no se hereda desde <use>: tiene que ir en el propio trazado (trazo de 1 px a cualquier tamaño).
		expect(svg).toMatch(/<path[^>]* vector-effect="non-scaling-stroke"/);
		// Sin colores propios: el relleno y el trazo los pone el CSS de cada mapa (.land), con los tokens del tema.
		expect(svg).not.toMatch(/<path[^>]* (fill|stroke|style)=/);
	});

	it('el globo sigue leyendo las costas', () => {
		// Cientos de islas y continentes, todos dentro del mapa de 360 × 180.
		const rings = parseRings(LAND);
		expect(rings.length).toBeGreaterThan(100);
		for (const ring of rings) for (const [lat, lon] of ring) {
			expect(Math.abs(lon)).toBeLessThanOrEqual(180);
			expect(Math.abs(lat)).toBeLessThanOrEqual(90);
		}
	});
});
