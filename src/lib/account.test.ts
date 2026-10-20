import { describe, expect, it } from 'vitest';
import { accountKeys, deleteOutcome, KEPT, LOGOUT, offlineMsg, PAGES, type Outcome } from './account.ts';
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

describe('deleteOutcome («Borrar mi cuenta»)', () => {
	const reply = (status: number, type: ResponseType = 'basic') => ({ ok: status >= 200 && status < 300, status, type });
	const msg = (o: Outcome) => (o.done ? '' : o.msg);

	it('si el servidor dice que sí, se sale; también tras un intento sin respuesta', () => {
		expect(deleteOutcome(reply(200), false)).toEqual({ done: true });
		expect(deleteOutcome(reply(200), true)).toEqual({ done: true });
	});

	it('sin respuesta no dice que no se ha borrado nada: la pestaña sigue parada y pide volver a pulsar', () => {
		const out = deleteOutcome(null, false);
		expect(out).toMatchObject({ done: false, held: true });
		expect(msg(out)).not.toContain(KEPT);
		expect(msg(out)).toMatch(/no se sabe si se ha borrado/);
		expect(msg(out)).toMatch(/Vuelve a pulsar/);
	});

	it('un error del servidor al primer intento: no se ha borrado nada y la pestaña vuelve a sincronizar', () => {
		for (const res of [reply(500), reply(503), reply(400)]) {
			const out = deleteOutcome(res, false);
			expect(out).toMatchObject({ done: false, held: false });
			expect(msg(out)).toContain(KEPT);
		}
	});

	it('sesión caducada (redirección de Access o 401): recargar, y no se ha borrado nada', () => {
		for (const res of [reply(0, 'opaqueredirect'), reply(401)]) {
			const out = deleteOutcome(res, false);
			expect(out).toMatchObject({ done: false, held: false });
			expect(msg(out)).toMatch(/caducado.*No se ha borrado nada/);
		}
	});

	it('tras un intento sin respuesta, un error no dice «No se ha borrado nada» ni suelta la pestaña', () => {
		for (const res of [null, reply(500), reply(401), reply(0, 'opaqueredirect')]) {
			const out = deleteOutcome(res, true);
			expect(out).toMatchObject({ done: false, held: true });
			expect(msg(out)).not.toContain(KEPT);
		}
	});

	it('sin conexión antes de enviar: nada borrado, salvo que quede la duda de antes', () => {
		expect(offlineMsg(false)).toContain(KEPT);
		expect(offlineMsg(true)).not.toContain(KEPT);
		expect(offlineMsg(true)).toMatch(/no se sabe/);
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
