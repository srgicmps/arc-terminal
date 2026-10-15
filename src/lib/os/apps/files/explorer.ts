// Archivos de Arc OS (el explorador), lógica pura sobre el modelo único de carpetas (src/lib/os/fs/fs.ts).
// Aquí: los sitios del sistema (virtuales y de solo lectura), las referencias de los archivos («note:<id>»,
// «tick:NVDA», «desk:d1», «fav:ECO TIPOS», «app:eco»), la fila que pinta cada cosa, ordenar, la selección
// (clic, Ctrl, Mayús y rectángulo), el historial atrás/adelante y las propiedades. Sin Svelte: se prueba con Vitest.
import { DESKTOP, isFolder, list, path as pathTo, rootOf, TRASH, within, type FsNode, type Tree } from '../../fs/fs.ts';

// ---- Referencias ----

export type RefKind = 'app' | 'note' | 'tick' | 'desk' | 'fav';
export interface Ref {
	kind: RefKind;
	id: string;
}
const KINDS: RefKind[] = ['app', 'note', 'tick', 'desk', 'fav'];

export function parseRef(ref: string): Ref | null {
	const i = ref.indexOf(':');
	const kind = ref.slice(0, i) as RefKind;
	const id = ref.slice(i + 1);
	return i > 0 && KINDS.includes(kind) && id ? { kind, id } : null;
}

/** La app que abre una referencia (la que va en `file.app`). Escritorios y favoritos los abre el propio explorador. */
export function refApp(r: Ref): string {
	if (r.kind === 'app') return r.id;
	if (r.kind === 'note') return 'notas';
	if (r.kind === 'tick') return 'mis';
	return 'archivos';
}

/** La referencia de un nodo (null si es una carpeta). */
export function nodeRef(n: FsNode): string | null {
	if (n.kind === 'app' && n.app) return `app:${n.app}`;
	if (n.kind === 'file' && n.file) return n.file.ref;
	return null;
}

/** El nodo que deja un acceso a `ref` en una carpeta: una app es un nodo 'app'; lo demás, un 'file'. */
export function accessNode(ref: string, name: string, parent: string): Omit<FsNode, 'id' | 'at'> | null {
	const r = parseRef(ref);
	if (!r) return null;
	if (r.kind === 'app') return { kind: 'app', name, parent, app: r.id };
	return { kind: 'file', name, parent, file: { app: refApp(r), ref } };
}

const TYPE: Record<RefKind, string> = { app: 'App', note: 'Nota', tick: 'Valor', desk: 'Escritorio', fav: 'Favorito' };

// ---- Ubicaciones: carpetas reales (DESKTOP, TRASH, id de nodo) y sitios del sistema («sys:…») ----

export const SYS_APPS = 'sys:apps';
export const SYS_NOTES = 'sys:notes';
export const SYS_MIS = 'sys:mis';
export const SYS_DESKS = 'sys:desks';
export const SYS_FAVS = 'sys:favs';
export const PLACES = [
	{ id: SYS_APPS, name: 'Apps', icon: 'folder' },
	{ id: SYS_NOTES, name: 'Notas', icon: 'notas' },
	{ id: SYS_MIS, name: 'Valores', icon: 'mis' },
	{ id: SYS_DESKS, name: 'Escritorios', icon: 'folder' },
	{ id: SYS_FAVS, name: 'Favoritos', icon: 'folder' }
] as const;
export const APP_KINDS = [
	{ id: 'vista', name: 'Vistas' },
	{ id: 'exp', name: 'Experiencias' },
	{ id: 'herramienta', name: 'Del sistema' }
] as const;

export const isSys = (loc: string) => loc.startsWith('sys:');

/** La ruta de la ventana («/desktop», «/trash», «/<id>», «/sys:notes») y al revés. */
export const locPath = (loc: string) => `/${loc}`;
export const locOf = (path: string | undefined) => (path && path.startsWith('/') && path.length > 1 ? path.slice(1) : DESKTOP);

/** Lo que el explorador sabe del resto de Arc (apps, notas, listas de MIS, escritorios, favoritos). */
export interface Ctx {
	apps: { id: string; name: string; kind: string }[];
	notes: { id: string; title: string; at: number; trashed?: boolean }[];
	lists: { name: string; codes: string[] }[];
	desks: { id: string; name: string }[];
	favs: string[];
}

/** Nombre de una ubicación. */
export function locName(tree: Tree, loc: string, ctx: Ctx): string {
	if (loc === DESKTOP) return 'Escritorio';
	if (loc === TRASH) return 'Papelera';
	const place = PLACES.find((p) => p.id === loc);
	if (place) return place.name;
	if (loc.startsWith(`${SYS_APPS}:`)) return APP_KINDS.find((k) => k.id === loc.slice(SYS_APPS.length + 1))?.name ?? 'Apps';
	if (loc.startsWith(`${SYS_MIS}:`)) return ctx.lists[Number(loc.slice(SYS_MIS.length + 1))]?.name ?? 'Lista';
	return tree[loc]?.name ?? 'Carpeta';
}

/** ¿Existe la ubicación? */
export function locExists(tree: Tree, loc: string, ctx: Ctx): boolean {
	if (!isSys(loc)) return isFolder(tree, loc);
	if (PLACES.some((p) => p.id === loc)) return true;
	if (loc.startsWith(`${SYS_APPS}:`)) return APP_KINDS.some((k) => `${SYS_APPS}:${k.id}` === loc);
	if (loc.startsWith(`${SYS_MIS}:`)) return !!ctx.lists[Number(loc.slice(SYS_MIS.length + 1))];
	return false;
}

/** La ruta (migas): de la raíz a la ubicación. */
export function crumbs(tree: Tree, loc: string, ctx: Ctx): { id: string; name: string }[] {
	if (isSys(loc)) {
		const top = PLACES.find((p) => loc === p.id || loc.startsWith(`${p.id}:`));
		if (!top) return [];
		const out: { id: string; name: string }[] = [{ id: top.id, name: top.name }];
		if (loc !== top.id) out.push({ id: loc, name: locName(tree, loc, ctx) });
		return out;
	}
	const root = rootOf(tree, loc);
	return [{ id: root, name: locName(tree, root, ctx) }, ...pathTo(tree, loc).filter((n) => n.id !== root).map((n) => ({ id: n.id, name: n.name }))];
}

/** La carpeta de arriba (null en una raíz). */
export function upOf(tree: Tree, loc: string): string | null {
	if (loc === DESKTOP || loc === TRASH) return null;
	if (isSys(loc)) {
		const i = loc.indexOf(':', 4);
		return i > 0 ? loc.slice(0, i) : null;
	}
	return tree[loc]?.parent ?? null;
}

// ---- Filas ----

export type ItemKind = 'folder' | 'app' | 'file';
export interface Item {
	/** El id del nodo; en lo virtual, «v:<ref>» o la ubicación a la que entra. */
	key: string;
	kind: ItemKind;
	name: string;
	/** Tipo para la columna y las propiedades. */
	type: string;
	/** id de OsIcon. */
	icon: string;
	/** Carpeta donde está (ubicación). */
	where: string;
	at?: number;
	/** Nodo real (lo tuyo: se mueve, se renombra, se tira). */
	node?: FsNode;
	/** Lo que abre (apps y archivos). */
	ref?: string;
	/** Carpeta a la que entra. */
	to?: string;
	trashed?: { from: string; at: number };
	/** El destino ya no está (una nota borrada, un escritorio cerrado). */
	missing?: boolean;
}

/** La fila de un nodo del árbol. `appName` da el nombre de una app (undefined si no está instalada). */
export function nodeItem(n: FsNode, appName: (id: string) => string | undefined, exists: (ref: string) => boolean = () => true): Item {
	const ref = nodeRef(n) ?? undefined;
	const r = ref ? parseRef(ref) : null;
	const type = n.kind === 'folder' ? 'Carpeta' : n.kind === 'app' ? `App · ${appName(n.app ?? '') ?? n.app}` : r ? TYPE[r.kind] : 'Archivo';
	const icon = n.kind === 'folder' ? 'folder' : n.kind === 'app' ? (n.app ?? 'file') : 'file';
	const missing = n.kind === 'app' ? !appName(n.app ?? '') : n.kind === 'file' ? !ref || !exists(ref) : false;
	return { key: n.id, kind: n.kind, name: n.name, type, icon, where: n.parent, at: n.at, node: n, ref, to: n.kind === 'folder' ? n.id : undefined, trashed: n.trashed, missing };
}

const virtual = (ref: string, name: string, where: string, at?: number): Item => {
	const r = parseRef(ref)!;
	return { key: `v:${ref}`, kind: r.kind === 'app' ? 'app' : 'file', name, type: TYPE[r.kind], icon: r.kind === 'app' ? r.id : r.kind === 'note' ? 'notas' : 'file', where, at, ref };
};
const sysFolder = (to: string, name: string, where: string, icon = 'folder'): Item => ({ key: to, kind: 'folder', name, type: 'Carpeta del sistema', icon, where, to });

/** Lo que hay en una ubicación del sistema. */
export function sysItems(loc: string, ctx: Ctx): Item[] {
	if (loc === SYS_APPS) return APP_KINDS.map((k) => sysFolder(`${SYS_APPS}:${k.id}`, k.name, loc));
	if (loc.startsWith(`${SYS_APPS}:`)) {
		const kind = loc.slice(SYS_APPS.length + 1);
		return ctx.apps.filter((a) => a.kind === kind).map((a) => virtual(`app:${a.id}`, a.name, loc));
	}
	if (loc === SYS_NOTES) return ctx.notes.filter((n) => !n.trashed).map((n) => virtual(`note:${n.id}`, n.title, loc, n.at));
	if (loc === SYS_MIS) return ctx.lists.map((l, i) => sysFolder(`${SYS_MIS}:${i}`, l.name, loc));
	if (loc.startsWith(`${SYS_MIS}:`)) return (ctx.lists[Number(loc.slice(SYS_MIS.length + 1))]?.codes ?? []).map((c) => c.split(':').pop()!).map((c) => virtual(`tick:${c}`, c, loc));
	if (loc === SYS_DESKS) return ctx.desks.map((d) => virtual(`desk:${d.id}`, d.name, loc));
	if (loc === SYS_FAVS) return ctx.favs.map((f) => virtual(`fav:${f}`, f, loc));
	return [];
}

/** Lo que hay en una carpeta tuya, o, al buscar, en ella y en todas sus subcarpetas. */
export function folderNodes(tree: Tree, loc: string, deep = false): FsNode[] {
	if (!deep) return list(tree, loc);
	return Object.values(tree).filter((n) => n.id !== loc && within(tree, n.id, loc));
}

/** ¿Sigue existiendo lo que abre una referencia? */
export function refExists(ref: string, ctx: Ctx): boolean {
	const r = parseRef(ref);
	if (!r) return false;
	if (r.kind === 'app') return ctx.apps.some((a) => a.id === r.id);
	if (r.kind === 'note') return ctx.notes.some((n) => n.id === r.id && !n.trashed);
	if (r.kind === 'desk') return ctx.desks.some((d) => d.id === r.id);
	return true;
}

// ---- Ordenar ----

export type SortCol = 'name' | 'type' | 'where' | 'at';
export interface Sort {
	col: SortCol;
	dir: 1 | -1;
}

/** Carpetas siempre primero; luego por la columna (y, a igualdad, por nombre). */
export function sortItems(items: Item[], sort: Sort, whereName: (loc: string) => string = (l) => l): Item[] {
	const key = (i: Item) => (sort.col === 'name' ? i.name : sort.col === 'type' ? i.type : sort.col === 'where' ? whereName(i.where) : '');
	return [...items].sort((a, b) => {
		const f = Number(b.kind === 'folder') - Number(a.kind === 'folder');
		if (f) return f;
		const c = sort.col === 'at' ? (a.at ?? 0) - (b.at ?? 0) : key(a).localeCompare(key(b), 'es', { sensitivity: 'base', numeric: true });
		return c * sort.dir || a.name.localeCompare(b.name, 'es', { numeric: true });
	});
}

/** Clic en la cabecera de una columna: la misma cambia el sentido; otra, ascendente (las fechas, de nueva a vieja). */
export const toggleSort = (s: Sort, col: SortCol): Sort => (s.col === col ? { col, dir: s.dir === 1 ? -1 : 1 } : { col, dir: col === 'at' ? -1 : 1 });

// ---- Selección ----

export interface Mods {
	ctrl?: boolean;
	shift?: boolean;
}

/**
 * Clic sobre `id` con la lista en `order`: solo él; con Ctrl o ⌘, lo añade o lo quita; con Mayús, el tramo desde
 * el ancla (el último clic sin Mayús). Devuelve la selección nueva y el ancla.
 */
export function clickSelect(order: string[], sel: string[], anchor: string | null, id: string, mods: Mods = {}): { sel: string[]; anchor: string } {
	if (mods.shift && anchor && order.includes(anchor)) {
		const [a, b] = [order.indexOf(anchor), order.indexOf(id)].sort((x, y) => x - y);
		const range = order.slice(a, b + 1);
		return { sel: mods.ctrl ? [...new Set([...sel, ...range])] : range, anchor };
	}
	if (mods.ctrl) return { sel: sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id], anchor: id };
	return { sel: [id], anchor: id };
}

export interface Box {
	x: number;
	y: number;
	w: number;
	h: number;
}
/** El rectángulo entre dos puntos. */
export const boxOf = (x0: number, y0: number, x1: number, y1: number): Box => ({ x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.abs(x1 - x0), h: Math.abs(y1 - y0) });
const meets = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
/** Lo que toca el rectángulo de selección. */
export const boxHits = (r: Box, boxes: [string, Box][]) => boxes.filter(([, b]) => meets(r, b)).map(([id]) => id);

// ---- Historial (atrás / adelante) ----

export interface Hist {
	back: string[];
	fwd: string[];
}
const MAX_HIST = 40;
export const visit = (h: Hist, from: string, to: string): Hist => (from === to ? h : { back: [...h.back, from].slice(-MAX_HIST), fwd: [] });
export function goBack(h: Hist, cur: string): { hist: Hist; to: string } | null {
	const to = h.back.at(-1);
	return to === undefined ? null : { hist: { back: h.back.slice(0, -1), fwd: [cur, ...h.fwd] }, to };
}
export function goForward(h: Hist, cur: string): { hist: Hist; to: string } | null {
	const to = h.fwd[0];
	return to === undefined ? null : { hist: { back: [...h.back, cur], fwd: h.fwd.slice(1) }, to };
}

// ---- Mover a… / Copiar acceso en… ----

/** Las carpetas donde se puede poner algo (Escritorio y las tuyas fuera de la papelera), con su ruta. */
export function folderChoices(tree: Tree, moving: string[] = []): { id: string; label: string }[] {
	const out = [{ id: DESKTOP, label: 'Escritorio' }];
	for (const n of Object.values(tree)) {
		if (n.kind !== 'folder' || rootOf(tree, n.id) !== DESKTOP || moving.some((m) => within(tree, n.id, m))) continue;
		out.push({ id: n.id, label: ['Escritorio', ...pathTo(tree, n.id).map((p) => p.name)].join(' › ') });
	}
	return out.sort((a, b) => (a.id === DESKTOP ? -1 : b.id === DESKTOP ? 1 : a.label.localeCompare(b.label, 'es')));
}

// ---- Propiedades ----

export interface PropNames {
	loc: (id: string) => string;
	app: (id: string) => string | undefined;
	date: (ms: number) => string;
}

/** Las filas del diálogo «Propiedades». */
export function properties(i: Item, names: PropNames): [string, string][] {
	const rows: [string, string][] = [
		['Nombre', i.name],
		['Tipo', i.type],
		['Ubicación', names.loc(i.where)]
	];
	if (i.at) rows.push(['Creado', names.date(i.at)]);
	if (i.ref) {
		const r = parseRef(i.ref);
		const opens = r?.kind === 'app' ? (names.app(r.id) ?? r.id) : r?.kind === 'desk' ? 'Cambia a ese escritorio' : r?.kind === 'fav' ? `La barra de comandos: ${r.id}` : r ? (names.app(refApp(r)) ?? refApp(r)) : '';
		rows.push(['Abre', i.missing ? `${opens} (ya no está)` : opens]);
		rows.push(['Referencia', i.ref]);
	} else if (i.kind === 'folder') rows.push(['Abre', 'Esta carpeta en Archivos']);
	if (!i.node) rows.push(['De', 'Arc (solo lectura): arrástralo a una carpeta para crear un acceso']);
	if (i.trashed) {
		rows.push(['En la papelera desde', names.date(i.trashed.at)]);
		rows.push(['Venía de', names.loc(i.trashed.from)]);
	}
	return rows;
}
