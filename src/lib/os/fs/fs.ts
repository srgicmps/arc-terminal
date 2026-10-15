// Archivos de Arc OS: el árbol de carpetas que comparten el escritorio y el explorador. Cada nodo es una carpeta,
// un acceso a una app o un archivo de una app (una nota…). Dos raíces fijas: el escritorio y la papelera.
// Se guarda entero en arc-os-fs (sincronizado con la cuenta). Lógica pura: todas las funciones devuelven un árbol
// nuevo y no tocan el que reciben.

export const DESKTOP = 'desktop';
export const TRASH = 'trash';
export const ROOTS = [DESKTOP, TRASH] as const;

export type NodeKind = 'folder' | 'app' | 'file';

export interface FsNode {
	id: string;
	kind: NodeKind;
	name: string;
	/** Carpeta donde está: otro nodo 'folder', DESKTOP o TRASH. */
	parent: string;
	/** kind 'app': id de la app (src/lib/os/apps.ts). */
	app?: string;
	/** kind 'file': la app que lo abre y su referencia dentro de ella. */
	file?: { app: string; ref: string };
	/** Creado (ms). */
	at: number;
	/** En la papelera: de dónde venía y cuándo se tiró. */
	trashed?: { from: string; at: number };
}

/** El árbol: los nodos por id. Las raíces no son nodos. */
export type Tree = Record<string, FsNode>;

/** Topes para que quepa en la cuenta. */
export const MAX_NODES = 400;
export const MAX_NAME = 60;
const MAX_DEPTH = 12;

const isRoot = (id: string) => (ROOTS as readonly string[]).includes(id);

/** Lo que hay en una carpeta, carpetas primero y luego por nombre. */
export function list(tree: Tree, parent: string): FsNode[] {
	return Object.values(tree)
		.filter((n) => n.parent === parent)
		.sort((a, b) => (a.kind === 'folder' ? 0 : 1) - (b.kind === 'folder' ? 0 : 1) || a.name.localeCompare(b.name, 'es'));
}

/** Nombre limpio: sin saltos ni espacios de más, con tope. */
export const cleanName = (name: string) => name.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME);

/** Un nombre que no esté ya en esa carpeta: «Carpeta nueva», «Carpeta nueva 2»… */
export function freeName(tree: Tree, parent: string, base: string, except?: string): string {
	const taken = new Set(list(tree, parent).filter((n) => n.id !== except).map((n) => n.name.toLowerCase()));
	if (!taken.has(base.toLowerCase())) return base;
	for (let i = 2; ; i++) if (!taken.has(`${base} ${i}`.toLowerCase())) return `${base} ${i}`;
}

let seq = 0;
/** Id nuevo, corto y único en el árbol. */
export function newId(tree: Tree, now = Date.now()): string {
	let id: string;
	do id = `n${now.toString(36)}${(seq++).toString(36)}`;
	while (tree[id] || isRoot(id));
	return id;
}

/** ¿Existe la carpeta (raíz o nodo carpeta)? */
export const isFolder = (tree: Tree, id: string) => isRoot(id) || tree[id]?.kind === 'folder';

/** Las carpetas desde la raíz hasta `id` (sin la raíz), para la ruta del explorador. */
export function path(tree: Tree, id: string): FsNode[] {
	const out: FsNode[] = [];
	let cur = tree[id];
	for (let i = 0; cur && i < MAX_DEPTH + 2; i++) {
		out.unshift(cur);
		cur = tree[cur.parent];
	}
	return out;
}

/** La raíz en la que está (DESKTOP o TRASH). */
export const rootOf = (tree: Tree, id: string) => (isRoot(id) ? id : (path(tree, id)[0]?.parent ?? DESKTOP));

/** ¿Está `id` dentro de `folder` (a cualquier profundidad, o es él mismo)? */
export function within(tree: Tree, id: string, folder: string): boolean {
	let cur: string | undefined = id;
	for (let i = 0; cur && i < MAX_DEPTH + 2; i++) {
		if (cur === folder) return true;
		cur = tree[cur]?.parent;
	}
	return false;
}

const depth = (tree: Tree, id: string) => (isRoot(id) ? 0 : path(tree, id).length);

/** Añade un nodo (carpeta, app o archivo) a una carpeta. Devuelve el árbol y el id nuevo (null si no cabe). */
export function add(tree: Tree, node: Omit<FsNode, 'id' | 'at'> & { at?: number }, now = Date.now()): { tree: Tree; id: string | null } {
	if (Object.keys(tree).length >= MAX_NODES || !isFolder(tree, node.parent)) return { tree, id: null };
	if (node.kind === 'folder' && depth(tree, node.parent) >= MAX_DEPTH) return { tree, id: null };
	const id = newId(tree, now);
	const name = freeName(tree, node.parent, cleanName(node.name) || 'Sin nombre');
	return { tree: { ...tree, [id]: { ...node, id, name, at: node.at ?? now } }, id };
}

export const mkdir = (tree: Tree, parent: string, name = 'Carpeta nueva', now = Date.now()) => add(tree, { kind: 'folder', name, parent }, now);

export function rename(tree: Tree, id: string, name: string): Tree {
	const n = tree[id];
	const clean = cleanName(name);
	if (!n || !clean) return tree;
	return { ...tree, [id]: { ...n, name: freeName(tree, n.parent, clean, id) } };
}

/** Mueve nodos a una carpeta. No mete una carpeta dentro de sí misma ni de sus hijas. */
export function move(tree: Tree, ids: string[], to: string): Tree {
	if (!isFolder(tree, to)) return tree;
	const out = { ...tree };
	for (const id of ids) {
		const n = out[id];
		if (!n || n.parent === to || within(out, to, id)) continue;
		if (n.kind === 'folder' && depth(out, to) >= MAX_DEPTH) continue;
		const { trashed: _, ...rest } = n;
		out[id] = { ...(to === TRASH ? n : rest), parent: to, name: freeName(out, to, n.name, id) };
	}
	return out;
}

/** A la papelera (con lo que lleve dentro, que va con su carpeta). Recuerda de dónde venía. */
export function trash(tree: Tree, ids: string[], now = Date.now()): Tree {
	const out = { ...tree };
	for (const id of ids) {
		const n = out[id];
		if (!n || rootOf(out, id) === TRASH) continue;
		out[id] = { ...n, parent: TRASH, trashed: { from: n.parent, at: now }, name: freeName(out, TRASH, n.name, id) };
	}
	return out;
}

/** Saca de la papelera a donde estaba (o al escritorio, si su carpeta ya no está). */
export function restore(tree: Tree, ids: string[]): Tree {
	let out = { ...tree };
	for (const id of ids) {
		const n = out[id];
		if (!n || n.parent !== TRASH) continue;
		const from = n.trashed?.from && isFolder(out, n.trashed.from) && rootOf(out, n.trashed.from) !== TRASH ? n.trashed.from : DESKTOP;
		out = move(out, [id], from);
	}
	return out;
}

/** Borra para siempre (con todo lo que tenga dentro). */
export function purge(tree: Tree, ids: string[]): Tree {
	const gone = new Set(Object.keys(tree).filter((k) => ids.some((id) => within(tree, k, id))));
	return Object.fromEntries(Object.entries(tree).filter(([k]) => !gone.has(k)));
}

export const emptyTrash = (tree: Tree) => purge(tree, list(tree, TRASH).map((n) => n.id));

/** Primera vez: el escritorio con las apps que había (las ancladas). */
export function seed(apps: { id: string; name: string }[], now = Date.now()): Tree {
	let tree: Tree = {};
	for (const a of apps) tree = add(tree, { kind: 'app', name: a.name, parent: DESKTOP, app: a.id }, now).tree;
	return tree;
}

/** ¿Hay ya un acceso a esa app en esa carpeta? */
export const findApp = (tree: Tree, app: string, parent = DESKTOP) => Object.values(tree).find((n) => n.kind === 'app' && n.app === app && n.parent === parent);

const ID = /^[a-z0-9:_-]{1,40}$/i;

/** Lo guardado (arc-os-fs), validado: descarta lo raro y lo que haya quedado sin carpeta. null si no hay nada. */
export function parseTree(raw: string | null): Tree | null {
	if (raw === null) return null;
	let v: unknown;
	try {
		v = JSON.parse(raw);
	} catch {
		return null;
	}
	if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
	const out: Tree = {};
	for (const [id, n] of Object.entries(v as Record<string, Partial<FsNode>>).slice(0, MAX_NODES)) {
		if (!ID.test(id) || isRoot(id) || !n || typeof n !== 'object') continue;
		if (n.kind !== 'folder' && n.kind !== 'app' && n.kind !== 'file') continue;
		if (typeof n.name !== 'string' || typeof n.parent !== 'string' || !ID.test(n.parent)) continue;
		const node: FsNode = { id, kind: n.kind, name: cleanName(n.name) || 'Sin nombre', parent: n.parent, at: Number.isFinite(n.at) ? Number(n.at) : 0 };
		if (n.kind === 'app') {
			if (typeof n.app !== 'string' || !ID.test(n.app)) continue;
			node.app = n.app;
		}
		if (n.kind === 'file') {
			if (!n.file || typeof n.file.app !== 'string' || typeof n.file.ref !== 'string' || n.file.ref.length > 200) continue;
			node.file = { app: n.file.app, ref: n.file.ref };
		}
		if (n.trashed && typeof n.trashed.from === 'string' && Number.isFinite(n.trashed.at)) node.trashed = { from: n.trashed.from, at: n.trashed.at };
		out[id] = node;
	}
	// Sin carpeta (o en un ciclo): al escritorio.
	for (const n of Object.values(out)) if (!isFolder(out, n.parent) || !reachesRoot(out, n.id)) out[n.id] = { ...n, parent: DESKTOP };
	return out;
}

/** ¿Subiendo de carpeta en carpeta se llega a una raíz (sin ciclos ni más hondo que el tope)? */
function reachesRoot(tree: Tree, id: string): boolean {
	let cur: string | undefined = tree[id]?.parent;
	for (let i = 0; cur !== undefined && i <= MAX_DEPTH + 1; i++) {
		if (isRoot(cur)) return true;
		cur = tree[cur]?.parent;
	}
	return false;
}
