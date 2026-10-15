// Archivos de Arc OS en el navegador: el árbol (fs.ts) guardado en localStorage «arc-os-fs» (en prefs.ts como dato,
// así se sincroniza con la cuenta) y las acciones que usan el escritorio, Archivos y los menús.
// Como un store de Pinia: un objeto reactivo (files) y unas funciones que cambian y guardan.
import { untrack } from 'svelte';
import { openApp } from '../os.svelte.ts';
import * as bridge from '../shell/bridge.ts';
import { setIcons, shell } from '../shell/shell.svelte.ts';
import { folderPath, migrateSpots, setFolderNamer, withoutSpots } from './desk.ts';
import * as fs from './fs.ts';
import { openRef } from '../apps/files/open.ts';
export const FS_KEY = 'arc-os-fs';

export const files = $state({
	tree: {} as fs.Tree,
	ready: false,
	/** Carpeta sobre la que se está arrastrando algo (se resalta). No se guarda. */
	hover: null as string | null,
	/** «Vaciar papelera…» pedido desde el escritorio: la ventana de la papelera pregunta. */
	ask: false
});

/** Nombre de una carpeta para la barra de título y la ruta. */
export const folderName = (id: string) => (id === fs.DESKTOP ? 'Escritorio' : id === fs.TRASH ? 'Papelera' : (files.tree[id]?.name ?? 'Carpeta'));

setFolderNamer(folderName);

function save() {
	try {
		localStorage.setItem(FS_KEY, JSON.stringify($state.snapshot(files.tree)));
	} catch {}
}
const set = (tree: fs.Tree) => {
	files.tree = tree;
	save();
};

/**
 * Lee lo guardado. La primera vez siembra el escritorio con las apps que había (las ancladas) y les deja la casilla
 * que tenían. Se llama al montar /os, después de loadShell.
 */
export function loadFiles(seedApps: { id: string; name: string }[]) {
	untrack(() => {
		if (files.ready) return;
		let raw: string | null = null;
		try {
			raw = localStorage.getItem(FS_KEY);
		} catch {}
		const saved = fs.parseTree(raw);
		if (saved) files.tree = saved;
		else {
			set(fs.seed(seedApps));
			setIcons(migrateSpots(shell.icons, files.tree));
		}
		files.ready = true;
	});
}

/** Los que se van del escritorio dejan su casilla libre. */
function leaveDesk(ids: string[]) {
	const gone = ids.filter((id) => files.tree[id]?.parent !== fs.DESKTOP);
	if (gone.some((id) => shell.icons[id])) setIcons(withoutSpots(shell.icons, gone));
}

export function mkdir(parent: string, name?: string): string | null {
	const r = fs.mkdir(files.tree, parent, name);
	if (r.id) set(r.tree);
	return r.id;
}
export const rename = (id: string, name: string) => set(fs.rename(files.tree, id, name));
export function move(ids: string[], to: string) {
	set(fs.move(files.tree, ids, to));
	leaveDesk(ids);
}
export function trash(ids: string[]) {
	set(fs.trash(files.tree, ids));
	leaveDesk(ids);
}
export const restore = (ids: string[]) => set(fs.restore(files.tree, ids));
export function purge(ids: string[]) {
	set(fs.purge(files.tree, ids));
	setIcons(withoutSpots(shell.icons, ids));
}
export const emptyTrash = () => set(fs.emptyTrash(files.tree));

/** Añade un nodo (un acceso que el explorador crea en una carpeta). Devuelve su id (null si no cabe). */
export function addNode(node: Omit<fs.FsNode, 'id' | 'at'>): string | null {
	const r = fs.add(files.tree, node);
	if (r.id) set(r.tree);
	return r.id;
}

/** Un acceso a la app en el escritorio (si ya lo hay, nada). */
export function addToDesktop(appId: string) {
	if (fs.findApp(files.tree, appId)) return;
	const app = bridge.apps.find((a) => a.id === appId);
	if (!app) return;
	set(fs.add(files.tree, { kind: 'app', name: app.title, parent: fs.DESKTOP, app: appId }).tree);
}
export const onDesktop = (appId: string) => !!fs.findApp(files.tree, appId);

/** Abre una carpeta en Archivos (la ventana que ya la enseña, al frente, o una nueva). */
export function openFolder(id: string) {
	openApp('archivos', folderPath(id));
}

export function openNode(node: fs.FsNode) {
	if (node.kind === 'folder') openFolder(node.id);
	else if (node.kind === 'app' && node.app) bridge.open(node.app);
	else if (node.kind === 'file' && node.file) openRef(node.file.ref);
}
export const openTrash = () => openFolder(fs.TRASH);

/** El icono que le toca a un nodo. */
export const iconFor = (n: fs.FsNode) => (n.kind === 'folder' ? 'folder' : n.kind === 'app' ? (n.app ?? 'file') : 'file');

// ---- Arrastrar entre el escritorio y las ventanas de carpeta ----

/**
 * El sitio donde soltar bajo el puntero: el data-fs-drop del primer elemento que no sea uno de los iconos que se
 * mueven (data-fs-item). Una ventana que no es de carpeta tapa lo de debajo: ahí no se suelta (null).
 */
export function dropTarget(x: number, y: number, moving: string[]): string | null {
	for (const el of document.elementsFromPoint(x, y)) {
		const item = el.closest<HTMLElement>('[data-fs-item]');
		if (item && moving.includes(item.dataset.fsItem!)) continue;
		return el.closest<HTMLElement>('[data-fs-drop]')?.dataset.fsDrop ?? null;
	}
	return null;
}

let deskPlace: ((ids: string[], x: number, y: number) => void) | null = null;
/** El escritorio dice cómo poner iconos en la casilla de un punto de la pantalla (lo usa la ventana de carpeta). */
export function onDeskPlace(fn: typeof deskPlace) {
	deskPlace = fn;
	return () => {
		if (deskPlace === fn) deskPlace = null;
	};
}
/** Lleva nodos al escritorio y los pone en la casilla del punto (x, y) de la pantalla. */
export function moveToDesk(ids: string[], x: number, y: number) {
	move(ids, fs.DESKTOP);
	deskPlace?.(ids, x, y);
}
