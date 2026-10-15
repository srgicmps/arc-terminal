import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isAppRoute, OPEN_IN_SIMPLE, sendToApp, tabOf } from './nav.ts';

describe('app Sencilla: navegación', () => {
	it('reconoce las rutas de la app', () => {
		expect(isAppRoute('/app')).toBe(true);
		expect(isAppRoute('/app/casa')).toBe(true);
		expect(isAppRoute('/apple')).toBe(false);
		expect(isAppRoute('/')).toBe(false);
	});

	it('marca la pestaña de cada ruta', () => {
		expect(tabOf('/app')).toBe('inicio');
		expect(tabOf('/app/dinero')).toBe('dinero');
		expect(tabOf('/app/buscar')).toBe('inicio');
	});

	it('en Sencillo lleva las vistas de Terminal a /app, salvo las abiertas y el modo TV', () => {
		expect(sendToApp('sencillo', '/eco')).toBe(true);
		expect(sendToApp('sencillo', '/')).toBe(true);
		expect(sendToApp('sencillo', '/app/casa')).toBe(false);
		expect(sendToApp('sencillo', '/modo')).toBe(false);
		expect(sendToApp('sencillo', '/', '?tv=TOP,WS')).toBe(false);
		expect(sendToApp('terminal', '/eco')).toBe(false);
	});

	it('src/app.html usa la misma lista antes de pintar', () => {
		const html = readFileSync('src/app.html', 'utf8');
		const list = html.match(/var open = \[([^\]]+)\]/)?.[1].split(',').map((s) => s.trim().replace(/'/g, ''));
		expect(list).toEqual(['/app', ...OPEN_IN_SIMPLE]);
	});
});
