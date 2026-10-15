import { describe, expect, it } from 'vitest';
import { APPS } from '../apps.ts';
import { arrange, folderName, place, rename, takeOut, badges, badgeText, CELLS, dockApps, drop, findApps, gesture, layout, readSeen, touch, used } from './home.ts';

describe('Modo OS en el móvil', () => {
	it('dock de 4 con la Terminal y sin repetir en las páginas', () => {
		const dock = dockApps(APPS);
		expect(dock.map((a) => a.id)).toEqual(['top', 'imp', 'ws', 'terminal']);
		const ids = layout(APPS).flat().flatMap((c) => (c.kind === 'app' ? [c.app.id] : []));
		expect(ids).not.toContain('ws');
		expect(ids.length + dock.length).toBe(APPS.length);
	});
	it('ninguna página se sale de la rejilla y la primera lleva widgets', () => {
		const pages = layout(APPS);
		expect(pages.every((p) => used(p) <= CELLS)).toBe(true);
		expect(used(pages[0])).toBe(CELLS);
		expect(pages[0].filter((c) => c.kind === 'widget').length).toBe(3);
	});
	it('Spotlight busca sin tildes, primero lo exacto', () => {
		expect(findApps(APPS, 'eco')[0].id).toBe('eco');
		expect(findApps(APPS, 'periodico').length).toBeGreaterThan(0);
		expect(findApps(APPS, '')).toEqual([]);
	});
	it('multitarea: la última, delante, como mucho 4', () => {
		expect(touch(['a', 'b', 'c', 'd'], 'e')).toEqual(['e', 'a', 'b', 'c']);
		expect(touch(['a', 'b'], 'b')).toEqual(['b', 'a']);
		expect(drop(['a', 'b'], 'a')).toEqual(['b']);
	});
	it('insignias de NOVEDADES desde la última vez', () => {
		const now = Date.parse('2026-10-15T12:00:00Z');
		const changes = [{ mergedAt: '2026-10-15T11:00:00Z' }, { mergedAt: '2026-10-13T11:00:00Z' }];
		expect(badges(changes, {}, now)).toEqual({ novedades: 1 });
		expect(badges(changes, { novedades: now }, now)).toEqual({});
		expect(badgeText(120)).toBe('99+');
		expect(readSeen('x')).toEqual({});
	});
	it('gestos', () => {
		const size = { w: 390, h: 844 };
		expect(gesture({ x: 50, y: 10 }, { x: 55, y: 200 }, size, false)).toBe('notif');
		expect(gesture({ x: 300, y: 10 }, { x: 300, y: 200 }, size, true)).toBe('control');
		expect(gesture({ x: 200, y: 400 }, { x: 200, y: 520 }, size, false)).toBe('spot');
		expect(gesture({ x: 200, y: 830 }, { x: 200, y: 760 }, size, true)).toBe('home');
		expect(gesture({ x: 200, y: 830 }, { x: 200, y: 500 }, size, true)).toBe('switch');
		expect(gesture({ x: 100, y: 400 }, { x: 300, y: 420 }, size, false)).toBeNull();
	});
	it('carpetas: juntar, añadir, sacar y deshacer', () => {
		let a = arrange(null, ['a', 'b', 'c', 'd', 'top'], ['top']);
		expect(a).toEqual({ items: ['a', 'b', 'c', 'd'], dock: ['top'] });
		a = place(a, { id: 'c' }, { kind: 'merge', key: 'a' }, 'Mercados', 'f1');
		expect(a.items).toEqual([{ id: 'f1', name: 'Mercados', apps: ['a', 'c'] }, 'b', 'd']);
		a = place(a, { id: 'top' }, { kind: 'merge', key: 'f1' });
		expect(a.dock).toEqual([]);
		expect(a.items[0]).toMatchObject({ apps: ['a', 'c', 'top'] });
		a = takeOut(a, 'f1', 'a');
		a = takeOut(a, 'f1', 'c');
		// Con una sola app, la carpeta desaparece y la app queda en su sitio.
		expect(a.items).toEqual(['top', 'c', 'a', 'b', 'd']);
		expect(place(a, { id: 'a' }, { kind: 'merge', key: 'a' })).toBe(a);
	});
	it('carpetas: orden, dock lleno y lo guardado se pone al día', () => {
		let a = arrange(null, ['a', 'b', 'c', 'w', 'x', 'y', 'z'], ['w', 'x', 'y', 'z']);
		expect(place(a, { id: 'a' }, { kind: 'dock', index: 0 })).toBe(a);
		a = place(a, { id: 'w' }, { kind: 'before', key: 'a' });
		expect(a).toEqual({ items: ['w', 'a', 'b', 'c'], dock: ['x', 'y', 'z'] });
		a = place(a, { id: 'c' }, { kind: 'dock', index: 1 });
		expect(a.dock).toEqual(['x', 'c', 'y', 'z']);
		a = place(a, { id: 'b' }, { kind: 'merge', key: 'w' }, 'Carpeta', 'f');
		a = rename(a, 'f', '  Mis   cosas ');
		const raw = JSON.stringify({ ...a, items: [...a.items, 'borrada', 'w'] });
		const back = arrange(raw, ['a', 'b', 'c', 'w', 'x', 'y', 'z', 'nueva']);
		expect(back.items).toEqual([{ id: 'f', name: 'Mis cosas', apps: ['w', 'b'] }, 'a', 'nueva']);
		expect(arrange('{mal', ['a']).items).toEqual(['a']);
		expect(folderName(['Mercados', 'Mercados'])).toBe('Mercados');
		expect(folderName(['Mercados', undefined])).toBe('Carpeta');
	});
	it('las carpetas cuentan una casilla en la rejilla', () => {
		const all = APPS.map((x) => x.id);
		const a = place(arrange(null, all), { id: 'eco' }, { kind: 'merge', key: 'geo' }, 'X', 'f');
		const cells = layout(APPS, a).flat();
		expect(cells.some((c) => c.kind === 'folder' && c.apps.length === 2)).toBe(true);
		expect(layout(APPS, a).every((p) => used(p) <= CELLS)).toBe(true);
	});
});
