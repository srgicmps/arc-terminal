import { describe, expect, it } from 'vitest';
import { APPS } from '../apps.ts';
import { badges, badgeText, CELLS, dockApps, drop, findApps, gesture, layout, readSeen, touch, used } from './home.ts';

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
});
