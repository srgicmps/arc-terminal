// Estado de la vista en la URL: qué parámetro se escribe y cuándo se quita.
import { describe, expect, it } from 'vitest';
import { withParam } from './urlstate.ts';

describe('withParam', () => {
	const base = new URL('https://srgicmps.github.io/arc-terminal/fuel?zona=28');

	it('pone el parámetro sin tocar los demás', () => {
		expect(withParam(base, 'combustible', 'diesel', 'g95').search).toBe('?zona=28&combustible=diesel');
	});

	it('quita el parámetro si vuelve al valor por defecto o es null', () => {
		const url = withParam(base, 'combustible', 'diesel', 'g95');
		expect(withParam(url, 'combustible', 'g95', 'g95').search).toBe('?zona=28');
		expect(withParam(url, 'zona', null).search).toBe('?combustible=diesel');
	});

	it('no cambia la URL que recibe', () => {
		withParam(base, 'zona', '07');
		expect(base.search).toBe('?zona=28');
	});
});
