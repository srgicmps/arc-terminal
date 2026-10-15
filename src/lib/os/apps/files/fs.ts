// Archivos de Arc OS: un sistema de archivos virtual. Los «archivos» son lo que ya tienes en Arc (apps y vistas,
// notas, valores de MIS, escritorios, favoritos de la barra); lo único que se guarda aquí (clave arc-os-files, en la
// cuenta) son tus carpetas, los accesos directos que metes en ellas, los nombres que les pones y la papelera.
// Lógica pura, con tests: las funciones cambian el estado que reciben (como un store de Pinia sin Pinia).

/** Qué abre un acceso directo: «app:eco», «note:k3j2», «tick:NVDA», «desk:d1», «fav:ECO TIPOS». */
export type Target = string;

export interface Folder {
	id: string;
	name: string;
	parent: string;
	trashed?: number;
}

export interface Link {
	id: string;
	target: Target;
	parent: string;
	/** Nombre propio; si no, el del destino. */
	name?: string;
	trashed?: number;
}

export interface FsState {
	v: 1;
	folders: Folder[];
	links: Link[];
	seq: number;
}

export const FILES_KEY = 'arc-os-files';
export const ROOT = 'root';
export const TRASH = 'trash';
export const MAX_ENTRIES = 300;

export const emptyFs = (): FsState => ({ v: 1, folders: [], links: [], seq: 1 });

export function readFs(v: unknown): FsState {
	const s = v as FsState;
	if (!s || s.v !== 1 || !Array.isArray(s.folders) || !Array.isArray(s.links)) return emptyFs();
	const folders = s.folders.filter((f) => f && typeof f.id === 'string' && typeof f.name === 'string' && typeof f.parent === 'string');
	const ids = new Set([ROOT, ...folders.map((f) => f.id)]);
	// Lo que cuelga de una carpeta que ya no existe vuelve a Inicio.
	for (const f of folders) if (!ids.has(f.parent)) f.parent = ROOT;
	const links = s.links.filter((l) => l && typeof l.id === 'string' && typeof l.target === 'string' && typeof l.parent === 'string');
	for (const l of links) if (!ids.has(l.parent)) l.parent = ROOT;
	return { v: 1, folders, links, seq: Number.isFinite(s.seq) ? s.seq : folders.length + links.length + 1 };
}

const count = (s: FsState) => s.folders.length + s.links.length;
const nextId = (s: FsState, p: string) => `${p}${(s.seq++).toString(36)}`;

/** Un nombre que no se repita en la carpeta: «Carpeta nueva», «Carpeta nueva 2»… */
export function freeName(s: FsState, parent: string, base: string): string {
	const taken = new Set(s.folders.filter((f) => f.parent === parent && !f.trashed).map((f) => f.name.toLowerCase()));
	if (!taken.has(base.toLowerCase())) return base;
	for (let i = 2; ; i++) if (!taken.has(`${base} ${i}`.toLowerCase())) return `${base} ${i}`;
}

export const cleanName = (name: string) => name.replace(/[\n\r\t/\\]/g, ' ').trim().slice(0, 60);

export function addFolder(s: FsState, parent: string, name = 'Carpeta nueva'): Folder | null {
	if (count(s) >= MAX_ENTRIES || !isFolder(s, parent)) return null;
	const f: Folder = { id: nextId(s, 'f'), name: freeName(s, parent, cleanName(name) || 'Carpeta nueva'), parent };
	s.folders.push(f);
	return f;
}

export function addLink(s: FsState, parent: string, target: Target): Link | null {
	if (count(s) >= MAX_ENTRIES || !isFolder(s, parent)) return null;
	const l: Link = { id: nextId(s, 'l'), target, parent };
	s.links.push(l);
	return l;
}

/** ¿Es una carpeta tuya (o Inicio) donde se puede guardar algo? */
export const isFolder = (s: FsState, id: string) => id === ROOT || s.folders.some((f) => f.id === id && !f.trashed);

export const findEntry = (s: FsState, id: string): Folder | Link | undefined => s.folders.find((f) => f.id === id) ?? s.links.find((l) => l.id === id);

export function rename(s: FsState, id: string, name: string): boolean {
	const e = findEntry(s, id);
	const clean = cleanName(name);
	if (!e || !clean) return false;
	e.name = clean;
	return true;
}

/** ¿`id` está dentro de `ancestor` (o es él)? Para no meter una carpeta dentro de sí misma. */
export function inside(s: FsState, id: string, ancestor: string): boolean {
	for (let cur: string | undefined = id, i = 0; cur && i < 100; i++) {
		if (cur === ancestor) return true;
		cur = s.folders.find((f) => f.id === cur)?.parent;
	}
	return false;
}

export function move(s: FsState, id: string, parent: string): boolean {
	const e = findEntry(s, id);
	if (!e || !isFolder(s, parent) || e.parent === parent) return false;
	if (!('target' in e) && inside(s, parent, id)) return false;
	e.parent = parent;
	return true;
}

/** A la papelera: una carpeta se lleva dentro lo suyo (se restaura todo junto). */
export function trash(s: FsState, id: string, now = Date.now()): boolean {
	const e = findEntry(s, id);
	if (!e || e.trashed) return false;
	e.trashed = now;
	return true;
}

export function restore(s: FsState, id: string): boolean {
	const e = findEntry(s, id);
	if (!e?.trashed) return false;
	delete e.trashed;
	if (!isFolder(s, e.parent)) e.parent = ROOT;
	return true;
}

/** Borra del todo (con lo que haya dentro, si es una carpeta). */
export function purge(s: FsState, id: string) {
	const doomed = new Set([id]);
	for (let grew = true; grew; ) {
		grew = false;
		for (const f of s.folders) if (doomed.has(f.parent) && !doomed.has(f.id)) (doomed.add(f.id), (grew = true));
	}
	s.folders = s.folders.filter((f) => !doomed.has(f.id));
	s.links = s.links.filter((l) => !doomed.has(l.id) && !doomed.has(l.parent));
}

/** Lo que hay en la papelera (solo lo de arriba: lo de dentro de una carpeta tirada va con ella). */
export function trashed(s: FsState): (Folder | Link)[] {
	const all = [...s.folders, ...s.links].filter((e) => e.trashed);
	const gone = new Set(s.folders.filter((f) => f.trashed).map((f) => f.id));
	return all.filter((e) => !hasGoneAncestor(s, e.parent, gone)).sort((a, b) => b.trashed! - a.trashed!);
}

function hasGoneAncestor(s: FsState, parent: string, gone: Set<string>) {
	for (let cur: string | undefined = parent, i = 0; cur && cur !== ROOT && i < 100; i++) {
		if (gone.has(cur)) return true;
		cur = s.folders.find((f) => f.id === cur)?.parent;
	}
	return false;
}

export function emptyTrash(s: FsState) {
	for (const e of trashed(s)) purge(s, e.id);
}

/** Lo que hay en una carpeta tuya (sin lo tirado). */
export const childrenOf = (s: FsState, parent: string) => ({
	folders: s.folders.filter((f) => f.parent === parent && !f.trashed).sort((a, b) => a.name.localeCompare(b.name, 'es')),
	links: s.links.filter((l) => l.parent === parent && !l.trashed)
});

/** La ruta de carpetas hasta `id` (para las migas: Inicio › Trabajo › Mercados). */
export function pathTo(s: FsState, id: string): Folder[] {
	const out: Folder[] = [];
	for (let cur = s.folders.find((f) => f.id === id), i = 0; cur && i < 100; i++) {
		out.unshift(cur);
		cur = s.folders.find((f) => f.id === cur!.parent);
	}
	return out;
}
