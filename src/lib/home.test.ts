import { describe, expect, it } from 'vitest';
import { homeChoices, startCommand } from './home.ts';

describe('vista de inicio', () => {
	it('va a la elegida solo la primera vez y sin parámetros', () => {
		expect(startCommand('IMP', false, '')?.code).toBe('IMP');
		expect(startCommand('IMP', true, '')).toBeNull();
		expect(startCommand('IMP', false, '?vista=x')).toBeNull();
	});

	it('se queda en TOP sin elección, con TOP o con un código que no vale', () => {
		expect(startCommand(null, false, '')).toBeNull();
		expect(startCommand('TOP', false, '')).toBeNull();
		expect(startCommand('TV', false, '')).toBeNull();
		expect(startCommand('XYZ', false, '')).toBeNull();
	});

	it('ofrece TOP y las vistas normales, sin el modo TV', () => {
		const codes = homeChoices().map((c) => c.code);
		expect(codes[0]).toBe('TOP');
		expect(codes).toContain('IMP');
		expect(codes).not.toContain('TV');
	});
});
