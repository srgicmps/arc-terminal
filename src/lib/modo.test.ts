import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decideModo } from './modo.ts';
import { hasTrim, isEssential, plainTitle } from './simple.ts';

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
	// Que src/app.html aplica la misma regla antes de pintar lo comprueba apphtml.test.ts, ejecutándolo.
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
	it('«Ver todos» solo en las vistas con lista', () => {
		expect(hasTrim('/eco')).toBe(true);
		expect(hasTrim('/')).toBe(true);
		expect(hasTrim('/boe')).toBe(false);
		expect(hasTrim(null)).toBe(false);
		expect(hasTrim('toString')).toBe(false);
	});
	it('títulos en español claro, conservando lo de detrás de « · »', () => {
		expect(plainTitle('PIB')).toBe('Crecimiento de la economía (PIB)');
		expect(plainTitle('Gasolina 95 · Menorca')).toBe('Gasolina · Menorca');
		expect(plainTitle('Titulares')).toBe('Titulares');
	});
});

// El HTML prerenderizado sale en Terminal, con todos los paneles: en Sencillo, una regla CSS de Panel esconde los que no
// son esenciales antes de que arranque Svelte, y al arrancar `gone` los quita. Si las dos cosas no dicen lo mismo, la
// vista salta al cargar o quedan paneles montados pero invisibles (el smoke lo mira en el navegador).
describe('Sencillo sin saltos al cargar', () => {
	it('Panel esconde por CSS lo mismo que quita `gone`', () => {
		const panel = readFileSync('src/lib/components/Panel.svelte', 'utf8');
		expect(panel).toContain('const gone = $derived(trimming() && !essential && !tv.on);');
		expect(panel).toContain('data-essential={essential || undefined}');
		expect(panel).toContain(":global(html[data-modo='sencillo']:not([data-all], [data-tv])) .panel:not([data-essential])");
	});
	it('«Ver todos» solo cambia con setAll, que lo apunta también en <html data-all>', () => {
		const files = readdirSync('src', { recursive: true, encoding: 'utf8' }).filter((f) => /\.(svelte|ts)$/.test(f) && !f.endsWith('modo.svelte.ts'));
		const direct = files.filter((f) => /\bmodo\.all\s*=[^=]/.test(readFileSync(`src/${f}`, 'utf8')));
		expect(direct).toEqual([]);
		expect(readFileSync('src/lib/modo.svelte.ts', 'utf8')).toContain("document.documentElement.toggleAttribute('data-all', value)");
	});
});
