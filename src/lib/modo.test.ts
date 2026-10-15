import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decideModo } from './modo.ts';
import { isEssential, plainTitle } from './simple.ts';

describe('decideModo', () => {
	it('lo guardado manda', () => {
		expect(decideModo('terminal', [])).toBe('terminal');
		expect(decideModo('sencillo', ['arc-theme'])).toBe('sencillo');
	});
	it('quien llega nuevo empieza en Sencillo; quien ya usaba la terminal sigue en Terminal', () => {
		expect(decideModo(null, [])).toBe('sencillo');
		expect(decideModo(null, ['otra-cosa', 'arc-modo'])).toBe('sencillo');
		expect(decideModo('raro', ['arc-last-visit'])).toBe('terminal');
	});
	it('src/app.html aplica la misma regla antes de pintar', () => {
		const html = readFileSync('src/app.html', 'utf8');
		expect(html).toContain("localStorage.getItem('arc-modo')");
		expect(html).toContain("k.indexOf('arc-') === 0 && k !== 'arc-modo'");
		expect(html).toContain('document.documentElement.dataset.modo = m');
	});
});

describe('paneles del modo Sencillo', () => {
	it('una vista sin lista se ve entera', () => {
		expect(isEssential('/boe', 'Lo que sea')).toBe(true);
	});
	it('por título exacto, sin tildes, o por lo que va antes de « · »', () => {
		expect(isEssential('/eco', 'Inflación')).toBe(true);
		expect(isEssential('/eco', 'inflacion')).toBe(true);
		expect(isEssential('/eco', 'Inflación del G20')).toBe(false);
		expect(isEssential('/eco', 'Balances de los bancos centrales')).toBe(false);
		expect(isEssential('/', 'Gasolina 95 · Madrid', 'fuel')).toBe(true);
		expect(isEssential('/', 'Hacker News', 'hn')).toBe(false);
	});
	it('títulos en español claro, conservando lo de detrás de « · »', () => {
		expect(plainTitle('PIB')).toBe('Crecimiento de la economía (PIB)');
		expect(plainTitle('Gasolina 95 · Menorca')).toBe('Gasolina · Menorca');
		expect(plainTitle('Titulares')).toBe('Titulares');
	});
});
