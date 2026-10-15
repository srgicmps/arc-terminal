// El escritorio y las ventanas de carpeta sobre el modelo de archivos (fs.ts): pasar las casillas de los iconos de
// antes (por id de app) a las de ahora (por id de nodo), qué hacer al soltar iconos arrastrados y cómo se guarda la
// carpeta en la ventana. Lógica pura.
import type { Spots } from '../shell/icons.ts';
import { DESKTOP, isFolder, rootOf, TRASH, within, type Tree } from './fs.ts';

/**
 * Primera vez con carpetas: las casillas de shell.icons iban por id de app; ahora van por id de nodo. Cada acceso del
 * escritorio se queda en la casilla que tenía su app (la Papelera, si ya tenía sitio, también).
 */
export function migrateSpots(spots: Spots, tree: Tree): Spots {
	const out: Spots = {};
	for (const n of Object.values(tree)) if (n.kind === 'app' && n.parent === DESKTOP && n.app && spots[n.app]) out[n.id] = spots[n.app];
	if (spots[TRASH]) out[TRASH] = spots[TRASH];
	return out;
}

/** Las casillas sin las de unos iconos (los que se han ido del escritorio). */
export const withoutSpots = (spots: Spots, ids: string[]): Spots => Object.fromEntries(Object.entries(spots).filter(([id]) => !ids.includes(id)));

export type Drop =
	| { kind: 'none' }
	/** Recolocar en el propio escritorio (casillas). */
	| { kind: 'desk' }
	| { kind: 'move'; ids: string[]; to: string }
	| { kind: 'trash'; ids: string[] };

/**
 * Qué pasa al soltar `ids` (que vienen de la carpeta `from`) sobre `target` (el data-fs-drop de debajo del puntero:
 * una carpeta, DESKTOP o TRASH; null si no es un sitio donde soltar). El icono Papelera (id TRASH) no se mueve a
 * ninguna carpeta: solo se recoloca en el escritorio.
 */
export function dropPlan(tree: Tree, ids: string[], from: string, target: string | null): Drop {
	if (target === null || !isFolder(tree, target)) return { kind: 'none' };
	if (target === DESKTOP && from === DESKTOP) return { kind: 'desk' };
	const nodes = ids.filter((id) => tree[id] && tree[id].parent !== target);
	if (target === TRASH) {
		const out = nodes.filter((id) => rootOf(tree, id) !== TRASH);
		return out.length ? { kind: 'trash', ids: out } : { kind: 'none' };
	}
	if (target === from) return { kind: 'none' };
	const out = nodes.filter((id) => !within(tree, target, id));
	return out.length ? { kind: 'move', ids: out, to: target } : { kind: 'none' };
}

// La carpeta que enseña una ventana va en su path, como «/<id>» (el núcleo solo guarda rutas que empiezan por «/»).
export const folderPath = (id: string) => `/${id}`;
export const folderOf = (path: string | undefined) => (path && path.length > 1 ? path.slice(1) : DESKTOP);

// Nombre de la carpeta para el título de la ventana. Lo pone fs.svelte.ts (que lee el árbol reactivo); así la app
// «carpeta», que se registra en apps.ts, no carga el estado del navegador.
let namer = (id: string): string => (id === DESKTOP ? 'Escritorio' : id === TRASH ? 'Papelera' : 'Carpeta');
export const setFolderNamer = (fn: (id: string) => string) => void (namer = fn);
export const folderTitle = (path: string | undefined) => namer(folderOf(path));
