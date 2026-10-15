import { describe, expect, it } from 'vitest';
import { APPS, appOfPath, embedSrc, findApp, unembed } from './apps.ts';

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
	});

	it('pone y quita el ?embed=1', () => {
		expect(embedSrc('/eco')).toBe('/eco?embed=1');
		expect(embedSrc('/news?q=a#p')).toBe('/news?q=a&embed=1#p');
		expect(unembed('/eco?embed=1')).toBe('/eco');
		expect(unembed('/news?q=a&embed=1')).toBe('/news?q=a');
		expect(unembed('/news?embed=1&q=a')).toBe('/news?q=a');
	});
});
