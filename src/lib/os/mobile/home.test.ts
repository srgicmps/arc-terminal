import { describe, expect, it } from 'vitest';
import { APPS } from '../apps.ts';
import { addWidget, arrange, badgesFor, badgeText, CELLS, dockApps, drop, folderName, gesture, keyboardFit, layout, readSession, webApp, noticesOf, place, removeWidget, rename, takeOut, touch, used } from './home.ts';

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
	it('multitarea: la última, delante, como mucho 4', () => {
		expect(touch(['a', 'b', 'c', 'd'], 'e')).toEqual(['e', 'a', 'b', 'c']);
		expect(touch(['a', 'b'], 'b')).toEqual(['b', 'a']);
		expect(drop(['a', 'b'], 'a')).toEqual(['b']);
	});
	it('insignias: lo no leído, en la app de su enlace, y todos los avisos en AVISOS', () => {
		const appOf = (h: string) => h.slice(1);
		const list = [
			{ id: 'a', kind: 'aviso', href: '/geo' },
			{ id: 'b', kind: 'novedad', href: '/novedades' },
			{ id: 'c', kind: 'novedad', href: '/novedades' }
		];
		expect(badgesFor(list, ['c'], appOf)).toEqual({ geo: 1, avisos: 1, novedades: 1 });
		expect(noticesOf(list, 'avisos', appOf)).toEqual(['a']);
		expect(noticesOf(list, 'novedades', appOf)).toEqual(['b', 'c']);
		expect(badgeText(120)).toBe('99+');
	});
	it('widgets: se quitan, se ponen y no pasan de 16 casillas', () => {
		let a = arrange(null, APPS.map((x) => x.id));
		expect(a.widgets).toEqual(['hoy', 'mundo', 'mercados']);
		a = addWidget(a, 'cripto');
		expect(addWidget(a, 'bonos')).toBe(a);
		expect(layout(APPS, a).every((p) => used(p) <= CELLS)).toBe(true);
		a = removeWidget(removeWidget(removeWidget(removeWidget(a, 'hoy'), 'mundo'), 'mercados'), 'cripto');
		expect(layout(APPS, a)[0].every((c) => c.kind !== 'widget')).toBe(true);
		expect(used(layout(APPS, a)[0])).toBe(CELLS);
		expect(arrange(JSON.stringify({ ...a, widgets: ['x', 'macro'] }), ['eco']).widgets).toEqual(['macro']);
	});
	it('una ruta sin app (la ficha de un valor) se abre con una app de paso', () => {
		expect(webApp('/s?sym=NVDA')).toMatchObject({ id: 'web:/s?sym=NVDA', name: 'NVDA', href: '/s?sym=NVDA' });
		expect(webApp('/modo', 'Modo').name).toBe('Modo');
	});
	it('teclado en pantalla: el teléfono ocupa lo visible; sin teclado o con zoom, nada', () => {
		expect(keyboardFit({ height: 500, offsetTop: 40, scale: 1 }, 844)).toEqual({ top: 40, h: 500 });
		expect(keyboardFit({ height: 800, offsetTop: 0, scale: 1 }, 844)).toBeNull();
		expect(keyboardFit({ height: 400, offsetTop: 0, scale: 2 }, 844)).toBeNull();
	});
	it('apps abiertas tras recargar: solo las que existen, sin rutas raras', () => {
		const known = (id: string) => ['imp', 'eco'].includes(id);
		const raw = JSON.stringify({ open: ['imp', 'nada', 'web:/s?sym=NVDA', 'imp', 'eco'], current: 'eco', paths: { imp: '/imp?p=semana', eco: 'javascript:x' }, names: { 'web:/s?sym=NVDA': 'NVIDIA' } });
		expect(readSession(raw, known)).toEqual({ open: ['imp', 'web:/s?sym=NVDA', 'eco'], current: 'eco', paths: { imp: '/imp?p=semana' }, names: { 'web:/s?sym=NVDA': 'NVIDIA' }, entry: false });
		expect(readSession('{', known)).toMatchObject({ open: [], current: null });
		expect(readSession(JSON.stringify({ open: ['imp'], current: 'nada' }), known).current).toBeNull();
	});
	it('gestos', () => {
		const size = { w: 390, h: 844 };
		expect(gesture({ x: 50, y: 10 }, { x: 55, y: 200 }, size, false)).toBe('notif');
		expect(gesture({ x: 300, y: 10 }, { x: 300, y: 200 }, size, true)).toBe('control');
		expect(gesture({ x: 200, y: 400 }, { x: 200, y: 520 }, size, false)).toBe('spot');
		expect(gesture({ x: 200, y: 830 }, { x: 200, y: 760 }, size, true)).toBe('home');
		expect(gesture({ x: 200, y: 830 }, { x: 200, y: 500 }, size, true)).toBe('switch');
		expect(gesture({ x: 100, y: 400 }, { x: 300, y: 420 }, size, false)).toBeNull();
		// Un tirón corto desde la barra (un cuarto largo de pantalla) va a inicio; si paras el dedo, a la multitarea.
		expect(gesture({ x: 200, y: 838 }, { x: 200, y: 600 }, size, true)).toBe('home');
		expect(gesture({ x: 200, y: 838 }, { x: 200, y: 700 }, size, true, { paused: true })).toBe('switch');
		// Con la zona segura del iPhone, la barra de estado baja: tirar desde ella sigue abriendo notificaciones.
		expect(gesture({ x: 50, y: 80 }, { x: 50, y: 300 }, size, false, { top: 103 })).toBe('notif');
		expect(gesture({ x: 50, y: 80 }, { x: 50, y: 300 }, size, false)).toBe('spot');
	});
	it('carpetas: juntar, añadir, sacar y deshacer', () => {
		let a = arrange(null, ['a', 'b', 'c', 'd', 'top'], ['top']);
		expect(a).toMatchObject({ items: ['a', 'b', 'c', 'd'], dock: ['top'] });
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
		expect(a).toMatchObject({ items: ['w', 'a', 'b', 'c'], dock: ['x', 'y', 'z'] });
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
