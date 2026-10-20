import { describe, expect, it } from 'vitest';
import { accountKeys, LOGOUT, PAGES } from './account.ts';
import { MEMORY } from './cloud.ts';
import { PREFS } from './prefs.ts';
import { portable } from './transfer.ts';

describe('accountKeys («Borrar mi cuenta»)', () => {
	it('borra lo tuyo y el tiempo de tu sitio; no toca la memoria de la sincronización ni lo que no es de Arc', () => {
		const keys = [
			'arc-mortgage',
			'arc-portfolio',
			'arc-journal',
			'arc-place',
			'arc-fuel-fav',
			'arc-localwx:39.89,4.26',
			'arc-layout-eco',
			'arc-os-note-1',
			MEMORY,
			'tradingview.chart',
			'otra'
		];
		expect(accountKeys(keys)).toEqual(keys.slice(0, -3));
	});

	it('todas las claves que van a la cuenta están en la lista', () => {
		const keys = PREFS.filter((p) => p.storage === 'local').map((p) => (p.prefix ? `${p.prefix}x` : p.key));
		for (const k of keys.filter(portable)) expect(accountKeys([k]), k).toEqual([k]);
	});

	it('solo localStorage: las cachés del service worker, IndexedDB y sessionStorage van aparte', () => {
		const others = PREFS.filter((p) => p.storage !== 'local').map((p) => p.key);
		expect(others).toContain(PAGES);
		expect(accountKeys(others)).toEqual([]);
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

	it('la memoria de la sincronización es la de prefs.ts', () => {
		expect(PREFS.find((p) => p.key === MEMORY)?.storage).toBe('local');
	});
});
