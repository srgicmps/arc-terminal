import { describe, expect, it } from 'vitest';
import { add, DESKTOP, mkdir, trash, TRASH, type Tree } from '../../fs/fs.ts';
import {
	accessNode,
	boxHits,
	boxOf,
	clickSelect,
	crumbs,
	folderChoices,
	folderNodes,
	goBack,
	goForward,
	locOf,
	locPath,
	nodeItem,
	parseRef,
	properties,
	refExists,
	sortItems,
	sysItems,
	toggleSort,
	upOf,
	visit,
	type Ctx,
	type Item
} from './explorer.ts';

const ctx: Ctx = {
	apps: [
		{ id: 'eco', name: 'Economía', kind: 'vista' },
		{ id: 'notas', name: 'Notas', kind: 'herramienta' }
	],
	notes: [
		{ id: 'k1', title: 'Ideas', at: 5 },
		{ id: 'k2', title: 'Vieja', at: 1, trashed: true }
	],
	lists: [{ name: 'Mía', codes: ['NASDAQ:NVDA', 'AAPL'] }],
	desks: [{ id: 'd1', name: 'Mercados' }],
	favs: ['ECO TIPOS']
};

function sample() {
	let t: Tree = {};
	const a = mkdir(t, DESKTOP, 'Trabajo', 1);
	t = a.tree;
	const b = mkdir(t, a.id!, 'Mercados', 2);
	t = b.tree;
	t = add(t, { ...accessNode('note:k1', 'Ideas', b.id!)! }, 3).tree;
	t = add(t, { ...accessNode('app:eco', 'Economía', DESKTOP)! }, 4).tree;
	return { t, a: a.id!, b: b.id! };
}

describe('Archivos: referencias', () => {
	it('lee y crea accesos', () => {
		expect(parseRef('fav:ECO TIPOS')).toEqual({ kind: 'fav', id: 'ECO TIPOS' });
		expect(parseRef('raro:1')).toBeNull();
		expect(parseRef('note:')).toBeNull();
		expect(accessNode('app:eco', 'E', DESKTOP)).toEqual({ kind: 'app', name: 'E', parent: DESKTOP, app: 'eco' });
		expect(accessNode('tick:NVDA', 'NVDA', DESKTOP)?.file).toEqual({ app: 'mis', ref: 'tick:NVDA' });
		expect(accessNode('note:k1', 'Ideas', DESKTOP)?.file?.app).toBe('notas');
	});
	it('sabe si el destino sigue', () => {
		expect(refExists('note:k1', ctx)).toBe(true);
		expect(refExists('note:k2', ctx)).toBe(false);
		expect(refExists('desk:d9', ctx)).toBe(false);
	});
});

describe('Archivos: ubicaciones', () => {
	it('ruta de la ventana', () => {
		expect(locOf(locPath('sys:notes'))).toBe('sys:notes');
		expect(locOf(undefined)).toBe(DESKTOP);
		expect(locOf('ECO')).toBe(DESKTOP);
	});
	it('migas y subir', () => {
		const { t, a, b } = sample();
		expect(crumbs(t, b, ctx).map((c) => c.name)).toEqual(['Escritorio', 'Trabajo', 'Mercados']);
		expect(crumbs(t, 'sys:apps:vista', ctx).map((c) => c.name)).toEqual(['Apps', 'Vistas']);
		expect(upOf(t, b)).toBe(a);
		expect(upOf(t, DESKTOP)).toBeNull();
		expect(upOf(t, 'sys:mis:0')).toBe('sys:mis');
		expect(upOf(t, 'sys:mis')).toBeNull();
	});
	it('sitios del sistema', () => {
		expect(sysItems('sys:notes', ctx).map((i) => i.name)).toEqual(['Ideas']);
		expect(sysItems('sys:mis:0', ctx).map((i) => i.ref)).toEqual(['tick:NVDA', 'tick:AAPL']);
		expect(sysItems('sys:apps:vista', ctx)[0]).toMatchObject({ kind: 'app', ref: 'app:eco', icon: 'eco' });
		expect(sysItems('sys:apps', ctx)).toHaveLength(3);
	});
	it('busca en subcarpetas', () => {
		const { t, a } = sample();
		expect(folderNodes(t, a).map((n) => n.name)).toEqual(['Mercados']);
		expect(folderNodes(t, a, true).map((n) => n.name).sort()).toEqual(['Ideas', 'Mercados']);
	});
	it('carpetas para «Mover a…», sin la que se mueve ni la papelera', () => {
		const { t, a, b } = sample();
		expect(folderChoices(t).map((c) => c.label)).toEqual(['Escritorio', 'Escritorio › Trabajo', 'Escritorio › Trabajo › Mercados']);
		expect(folderChoices(t, [a]).map((c) => c.id)).toEqual([DESKTOP]);
		expect(folderChoices(trash(t, [b])).map((c) => c.id)).toEqual([DESKTOP, a]);
	});
});

describe('Archivos: filas, orden y propiedades', () => {
	const appName = (id: string) => ctx.apps.find((a) => a.id === id)?.name;
	it('fila de un nodo', () => {
		const { t } = sample();
		const items = Object.values(t).map((n) => nodeItem(n, appName, (r) => refExists(r, ctx)));
		expect(items.find((i) => i.ref === 'note:k1')).toMatchObject({ type: 'Nota', icon: 'file', missing: false });
		expect(items.find((i) => i.ref === 'app:eco')).toMatchObject({ type: 'App · Economía', icon: 'eco' });
	});
	it('ordena con las carpetas primero', () => {
		const it = (key: string, kind: Item['kind'], name: string, at: number): Item => ({ key, kind, name, type: kind, icon: 'file', where: DESKTOP, at });
		const items = [it('1', 'file', 'b', 3), it('2', 'folder', 'z', 1), it('3', 'file', 'a', 2)];
		expect(sortItems(items, { col: 'name', dir: 1 }).map((i) => i.key)).toEqual(['2', '3', '1']);
		expect(sortItems(items, { col: 'name', dir: -1 }).map((i) => i.key)).toEqual(['2', '1', '3']);
		expect(sortItems(items, { col: 'at', dir: -1 }).map((i) => i.key)).toEqual(['2', '1', '3']);
		expect(toggleSort({ col: 'name', dir: 1 }, 'name')).toEqual({ col: 'name', dir: -1 });
		expect(toggleSort({ col: 'name', dir: 1 }, 'at')).toEqual({ col: 'at', dir: -1 });
	});
	it('propiedades, también de lo tirado', () => {
		const { t, b } = sample();
		const t2 = trash(t, [b], 99);
		const i = nodeItem(t2[b], appName);
		const rows = Object.fromEntries(properties(i, { loc: (l) => (l === TRASH ? 'Papelera' : l === DESKTOP ? 'Escritorio' : (t2[l]?.name ?? l)), app: appName, date: String }));
		expect(rows['Ubicación']).toBe('Papelera');
		expect(rows['En la papelera desde']).toBe('99');
		expect(rows['Venía de']).toBe('Trabajo');
		const v = sysItems('sys:notes', ctx)[0];
		expect(Object.fromEntries(properties(v, { loc: String, app: appName, date: String }))['Abre']).toBe('Notas');
	});
});

describe('Archivos: selección e historial', () => {
	const order = ['a', 'b', 'c', 'd'];
	it('clic, Ctrl y Mayús', () => {
		let s = clickSelect(order, [], null, 'b');
		expect(s).toEqual({ sel: ['b'], anchor: 'b' });
		s = clickSelect(order, s.sel, s.anchor, 'd', { shift: true });
		expect(s.sel).toEqual(['b', 'c', 'd']);
		s = clickSelect(order, s.sel, s.anchor, 'c', { ctrl: true });
		expect(s.sel).toEqual(['b', 'd']);
		expect(clickSelect(order, ['a'], 'c', 'a', { shift: true }).sel).toEqual(['a', 'b', 'c']);
	});
	it('rectángulo', () => {
		const r = boxOf(50, 50, 0, 0);
		expect(r).toEqual({ x: 0, y: 0, w: 50, h: 50 });
		expect(boxHits(r, [['a', { x: 40, y: 40, w: 20, h: 20 }], ['b', { x: 60, y: 0, w: 10, h: 10 }]])).toEqual(['a']);
	});
	it('atrás y adelante', () => {
		let h = visit({ back: [], fwd: [] }, 'desktop', 'x');
		const b = goBack(h, 'x')!;
		expect(b.to).toBe('desktop');
		const f = goForward(b.hist, 'desktop')!;
		expect(f.to).toBe('x');
		h = visit(b.hist, 'desktop', 'y');
		expect(h.fwd).toEqual([]);
		expect(goBack({ back: [], fwd: [] }, 'a')).toBeNull();
	});
});
