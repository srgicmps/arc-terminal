import { describe, expect, it } from 'vitest';
import { homeChoices, startPath } from './home.ts';

describe('vista de inicio', () => {
	it('va a la elegida solo la primera vez y sin parámetros', () => {
		expect(startPath('IMP', false, '')).toBe('/imp');
		expect(startPath('IMP', true, '')).toBeNull();
		expect(startPath('IMP', false, '?vista=x')).toBeNull();
	});

	it('se queda en TOP sin elección, con TOP o con un código que no vale', () => {
		expect(startPath(null, false, '')).toBeNull();
		expect(startPath('TOP', false, '')).toBeNull();
		expect(startPath('TV', false, '')).toBeNull();
		expect(startPath('XYZ', false, '')).toBeNull();
		expect(startPath('x:noexiste', false, '')).toBeNull();
	});

	it('ofrece TOP y las vistas normales, sin el modo TV', () => {
		const codes = homeChoices().map((c) => c.code);
		expect(codes[0]).toBe('TOP');
		expect(codes).toContain('IMP');
		expect(codes).not.toContain('TV');
	});
});
