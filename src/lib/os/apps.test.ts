import { describe, expect, it } from 'vitest';
import { APPS, appOfPath, embedSrc, findApp, unembed, winTitle } from './apps.ts';
import valor, { symOf } from './apps/valor.ts';

describe('apps de Arc OS', () => {
	it('salen de los comandos y de las experiencias, sin repetir ids', () => {
		expect(new Set(APPS.map((a) => a.id)).size).toBe(APPS.length);
		expect(findApp('eco')).toMatchObject({ kind: 'vista', code: 'ECO', href: '/eco' });
		expect(findApp('x:zen')).toMatchObject({ kind: 'exp', href: '/x/zen' });
		expect(findApp('tv')).toBeUndefined();
		for (const a of APPS) expect(a.href || a.load, a.id).toBeTruthy();
	});

	it('encuentra la app de una ruta', () => {
		expect(appOfPath('/eco?x=1')?.id).toBe('eco');
		expect(appOfPath('/x/zen/')?.id).toBe('x:zen');
		expect(appOfPath('/')?.id).toBe('top');
		expect(appOfPath('/no-existe')).toBeUndefined();
		// La ficha de un valor no es un comando, pero tiene su app (si no, «NVDA» en el buscador no abría nada).
		expect(appOfPath('/s?sym=NVDA')?.id).toBe('valor');
		expect(appOfPath('/semana')?.id).toBe('semana');
	});

	it('pone y quita el ?embed=1', () => {
		expect(embedSrc('/eco')).toBe('/eco?embed=1');
		expect(embedSrc('/news?q=a#p')).toBe('/news?q=a&embed=1#p');
		expect(unembed('/eco?embed=1')).toBe('/eco');
		expect(unembed('/news?q=a&embed=1')).toBe('/news?q=a');
		expect(unembed('/news?embed=1&q=a')).toBe('/news?q=a');
	});
});

describe('título de ventana', () => {
	it('dice lo que enseña en claro, sin la ruta', () => {
		const app = (id: string) => findApp(id)!;
		expect(winTitle(app('pais'), '/pais?c=CN')).toBe(`${app('pais').name} · CN`);
		expect(winTitle(app('news'), '/news?q=aranceles&embed=1')).toBe(`${app('news').name} · aranceles`);
		expect(winTitle(app('eco'), '/eco#paro')).toBe(app('eco').name);
		expect(winTitle(app('eco'), '/eco')).toBe(app('eco').name);
		expect(winTitle(app('expediente'), '/expediente#country:CN')).not.toContain('/');
	});
});

describe('app Valor', () => {
	it('el título lleva el símbolo de la ruta', () => {
		expect(symOf('/s?sym=aapl')).toBe('AAPL');
		expect(symOf('/s?sym=SAN.MC&fn=gp#x')).toBe('SAN.MC');
		expect(symOf(undefined)).toBe('NVDA');
		expect(valor.title?.('/s?sym=MSFT')).toBe('Valor · MSFT');
	});
});
