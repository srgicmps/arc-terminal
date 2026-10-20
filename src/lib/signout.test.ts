import { describe, expect, it } from 'vitest';
import { PREFS } from './prefs.ts';
import { LOGOUT, PAGES, signOutKeys } from './signout.ts';
import { portable } from './transfer.ts';

describe('signOutKeys («Cerrar sesión» y «Borrar mi cuenta»)', () => {
	it('borra lo tuyo, la memoria de la sincronización y el tiempo de tu sitio; no toca lo que no es de Arc', () => {
		const keys = [
			'arc-mortgage',
			'arc-portfolio',
			'arc-journal',
			'arc-place',
			'arc-fuel-fav',
			'arc-sync',
			'arc-localwx:39.89,4.26',
			'arc-layout-eco',
			'arc-os-note-1',
			'tradingview.chart',
			'otra'
		];
		expect(signOutKeys(keys)).toEqual(keys.slice(0, -2));
	});

	it('todas las claves que van a la cuenta están en la lista: al volver a entrar, bajan de ella', () => {
		const keys = PREFS.filter((p) => p.storage === 'local').map((p) => (p.prefix ? `${p.prefix}x` : p.key));
		for (const k of keys.filter(portable)) expect(signOutKeys([k]), k).toEqual([k]);
	});

	it('solo localStorage: las cachés del service worker, IndexedDB y sessionStorage van aparte', () => {
		const others = PREFS.filter((p) => p.storage !== 'local').map((p) => p.key);
		expect(others).toContain(PAGES);
		expect(signOutKeys(others)).toEqual([]);
	});
});

describe('salida', () => {
	it('va a la salida de Access de esta misma web, que el service worker deja pasar (/cdn-cgi/)', () => {
		expect(LOGOUT).toBe('/cdn-cgi/access/logout');
	});

	it('la caché de vistas que se borra es la del service worker', async () => {
		const { readFile } = await import('node:fs/promises');
		const sw = await readFile(new URL('../service-worker/index.ts', import.meta.url), 'utf8');
		expect(sw).toContain(`const PAGES = '${PAGES}'`);
		expect(sw).toMatch(/startsWith\('\/cdn-cgi\/'\)\) return;/);
	});
});
