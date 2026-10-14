import { describe, expect, it } from 'vitest';
import { rgba, token } from './color.ts';

describe('rgba', () => {
	it('convierte #rrggbb en rgba, con la transparencia pedida o 1', () => {
		expect(rgba('#4cc48a', 0.08)).toBe('rgba(76, 196, 138, 0.08)');
		expect(rgba('#F2A83B')).toBe('rgba(242, 168, 59, 1)');
	});

	it('lee la transparencia de #rrggbbaa', () => {
		expect(rgba('#9a5a001a')).toBe('rgba(154, 90, 0, 0.1)');
	});

	it('deja igual lo que no es hexadecimal', () => {
		expect(rgba('rgba(1, 2, 3, 0.5)')).toBe('rgba(1, 2, 3, 0.5)');
		expect(rgba('')).toBe('');
	});
});

describe('token', () => {
	it('devuelve vacío fuera del navegador', () => {
		expect(token('--up')).toBe('');
	});
});
