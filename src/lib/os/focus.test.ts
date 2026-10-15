import { describe, expect, it } from 'vitest';
import { nearestIndex, trapStep } from './focus.ts';

describe('nearestIndex: flechas entre iconos', () => {
	// Rejilla de iconos en columnas (como el escritorio): a (0,0), b (0,100), c (100,0), d (100,200).
	const pts = [
		{ x: 0, y: 0 },
		{ x: 0, y: 100 },
		{ x: 100, y: 0 },
		{ x: 100, y: 200 }
	];
	it('va al de al lado en la dirección pedida', () => {
		expect(nearestIndex(pts[0], pts, [0, 1])).toBe(1);
		expect(nearestIndex(pts[0], pts, [1, 0])).toBe(2);
		expect(nearestIndex(pts[1], pts, [0, -1])).toBe(0);
	});
	it('salta huecos y prefiere el que está en línea', () => {
		expect(nearestIndex(pts[2], pts, [0, 1])).toBe(3);
		expect(nearestIndex(pts[1], pts, [1, 0])).toBe(2);
	});
	it('-1 si no hay nada en esa dirección', () => {
		expect(nearestIndex(pts[0], pts, [-1, 0])).toBe(-1);
		expect(nearestIndex(pts[0], pts, [0, -1])).toBe(-1);
	});
});

describe('trapStep: Tab dentro de un diálogo modal', () => {
	it('del último vuelve al primero, y con ⇧ al revés', () => {
		expect(trapStep(2, 3, false)).toBe(0);
		expect(trapStep(0, 3, true)).toBe(2);
	});
	it('en medio deja hacer al navegador', () => {
		expect(trapStep(1, 3, false)).toBeNull();
		expect(trapStep(1, 3, true)).toBeNull();
	});
	it('desde fuera entra por el principio (o por el final con ⇧)', () => {
		expect(trapStep(-1, 3, false)).toBe(0);
		expect(trapStep(-1, 3, true)).toBe(2);
	});
	it('sin nada enfocable no mueve', () => expect(trapStep(-1, 0, false)).toBeNull());
});
