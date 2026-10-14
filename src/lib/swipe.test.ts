import { describe, expect, it } from 'vitest';
import { neighbour, nudge, swipeDirection } from './swipe.ts';

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
});
