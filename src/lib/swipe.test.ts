import { describe, expect, it } from 'vitest';
import { isOnRoute, neighbour, nudge, preloadDirection, swipeDirection } from './swipe.ts';

describe('deslizar entre vistas', () => {
	it('cuenta solo los gestos horizontales, largos y rápidos', () => {
		expect(swipeDirection(-120, 10, 300)).toBe(1);
		expect(swipeDirection(120, 10, 300)).toBe(-1);
		expect(swipeDirection(-60, 0, 300)).toBe(0);
		expect(swipeDirection(-120, 80, 300)).toBe(0);
		expect(swipeDirection(-120, 0, 900)).toBe(0);
	});
	it('no da la vuelta en los extremos', () => {
		expect(neighbour(['TOP', 'ECO'], 1, 1)).toBeNull();
		expect(neighbour(['TOP', 'ECO'], 0, 1)).toBe('ECO');
		expect(neighbour(['TOP', 'ECO'], -1, 1)).toBeNull();
	});
	it('el desplazamiento de pista no pasa de 24 px', () => {
		expect(nudge(-400)).toBe(-24);
		expect(nudge(40)).toBe(6);
	});
	it('precarga la vista del lado al que va el dedo en cuanto se sabe, antes de soltar', () => {
		expect(preloadDirection(-40, 5)).toBe(1);
		expect(preloadDirection(40, 5)).toBe(-1);
		// Justo por debajo de la mitad del mínimo, aún no.
		expect(preloadDirection(-39, 0)).toBe(0);
		// Un gesto casi vertical es scroll: nada.
		expect(preloadDirection(-60, 40)).toBe(0);
		expect(preloadDirection(0, 0)).toBe(0);
	});
});

describe('isOnRoute (QA T7)', () => {
	it('marca la sección también en sus subrutas, pero la portada solo en /', () => {
		expect(isOnRoute('/x/periodico', '/x')).toBe(true);
		expect(isOnRoute('/x', '/x')).toBe(true);
		expect(isOnRoute('/xyz', '/x')).toBe(false);
		expect(isOnRoute('/eco', '/')).toBe(false);
		expect(isOnRoute('/', '/')).toBe(true);
		expect(isOnRoute(null, '/eco')).toBe(false);
	});
});
