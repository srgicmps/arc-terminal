import { describe, expect, it } from 'vitest';
import { stepRow } from './rownav.ts';

describe('teclado en listas', () => {
	it('pasa a la siguiente o la anterior sin salirse', () => {
		expect(stepRow(5, 2, 1)).toBe(3);
		expect(stepRow(5, 4, 1)).toBe(4);
		expect(stepRow(5, 0, -1)).toBe(0);
	});

	it('sin fila actual, empieza por arriba (j) o por abajo (k)', () => {
		expect(stepRow(5, -1, 1)).toBe(0);
		expect(stepRow(5, -1, -1)).toBe(4);
		expect(stepRow(0, -1, 1)).toBe(-1);
	});
});
