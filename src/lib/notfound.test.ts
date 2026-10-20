// Página de error: «¿Querías decir…?» y las vistas guardadas para usar sin conexión.
import { describe, expect, it } from 'vitest';
import { guessCommand, PAGES_CACHE, savedViews } from './notfound.ts';
import worker from '../service-worker/index.ts?raw';

const guess = (path: string) => guessCommand(path)?.code;

describe('guessCommand', () => {
	it('el código o un alias enteros, con o sin barra al final', () => {
		expect(guess('/eco/')).toBe('ECO');
		expect(guess('/ECO')).toBe('ECO');
		expect(guess('/gasolina')).toBe('FUEL');
		expect(guess('/espa%C3%B1a')).toBe('ES');
	});

	it('el principio de un código o de un alias', () => {
		expect(guess('/ec')).toBe('ECO');
		expect(guess('/hipotec')).toBe('HIPOTECA');
		expect(guess('/gasoli')).toBe('FUEL');
	});

	it('un código de Bloomberg lleva a su comando', () => {
		expect(guess('/wirp')).toBe('ECO');
	});

	it('una errata, también con una letra de más al final', () => {
		expect(guess('/goe')).toBe('GEO');
		expect(guess('/fuels')).toBe('FUEL');
		expect(guess('/eocn')).toBe('ECO');
		expect(guess('/x/hipotca')).toBe('HIPOTECA');
	});

	it('nada si no se parece a ninguna vista, y nunca la ficha de un valor', () => {
		expect(guess('/zzz')).toBeUndefined();
		expect(guess('/zzzz')).toBeUndefined();
		expect(guess('/nvda')).toBeUndefined();
		expect(guess('/')).toBeUndefined();
		expect(guess('/%E0%A4%A')).toBeUndefined();
	});
});

describe('savedViews', () => {
	const site = 'https://arcterminal.dev';

	it('convierte las claves de la caché en vistas, sin __data.json, sin data/ y sin repetir', () => {
		const keys = [`${site}/`, `${site}/__data.json`, `${site}/eco`, `${site}/eco/__data.json`, `${site}/data/search.json`, `${site}/data/fuel/07.json`, `${site}/fuel/`];
		expect(savedViews(keys).map((c) => c.code)).toEqual(['TOP', 'ECO', 'FUEL']);
	});

	it('ignora lo que no es una vista de la barra y respeta la carpeta de la web', () => {
		expect(savedViews([`${site}/x/zen/__data.json`, `${site}/s`, 'no es una url'])).toEqual([]);
		expect(savedViews([`${site}/arc/luz/__data.json`, `${site}/arc/data/luz.json`], '/arc').map((c) => c.code)).toEqual(['LUZ']);
	});
});

it('la caché de páginas se llama igual que en el service worker', () => {
	expect(worker).toContain(`const PAGES = '${PAGES_CACHE}';`);
});
