// Estado de la vista en la URL: qué parámetro se escribe y cuándo se quita.
import { describe, expect, it } from 'vitest';
import { navCounter, withParam } from './urlstate.ts';

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

describe('navCounter', () => {
	const at = (href: string) => new URL(href, 'https://arcterminal.dev');

	it('sube con cada navegación, también a la misma dirección («ECO TIPOS» otra vez)', () => {
		const count = navCounter();
		expect(count(at('/eco'), false)).toBe(1);
		expect(count(at('/eco#panel=Tipos'), true)).toBe(2);
		expect(count(at('/eco#panel=Tipos'), true)).toBe(3);
	});

	it('un salto a otro #hash de la misma página sin navegar («Saltar al contenido», atrás entre dos #hash) no cuenta', () => {
		const count = navCounter();
		count(at('/boe?q=vivienda'), false);
		expect(count(at('/boe?q=vivienda#contenido'), false)).toBe(1);
		expect(count(at('/boe?q=vivienda'), false)).toBe(1);
		// Otra dirección sin navegar (la primera tras escribir con writeParams y un enlace a #hash), sí.
		expect(count(at('/boe?q=alquiler#contenido'), false)).toBe(2);
	});

	it('un refresco de datos (otro objeto, misma dirección, sin navegar) no cuenta', () => {
		const count = navCounter();
		count(at('/news?q=lagarde'), false);
		const refreshed = at('/news?q=lagarde');
		expect(count(refreshed, false)).toBe(1);
		// Volver a leer el mismo objeto tampoco cuenta.
		expect(count(refreshed, true)).toBe(1);
	});
});
