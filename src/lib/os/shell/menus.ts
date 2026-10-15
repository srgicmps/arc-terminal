// Menús de clic derecho de la barra de tareas, el dock y las pestañas de DSM: los mismos en los tres sitios.
import type { MenuEntry } from '../../components/os/ContextMenu.svelte';
import { addToDesktop, onDesktop } from '../fs/fs.svelte.ts';
import * as os from './bridge.ts';
import { pin, shell } from './shell.svelte.ts';
import type { TaskWin } from './types.ts';

/** Una ventana abierta: traer al frente, minimizar, ampliar, otra ventana, anclar y cerrar. */
export function winMenu(w: TaskWin): MenuEntry[] {
	const pinned = shell.pinned.includes(w.appId);
	return [
		{ label: w.minimized ? 'Restaurar' : 'Traer al frente', run: () => os.focusWin(w.id) },
		{ label: 'Minimizar', kbd: 'Alt+↓', disabled: w.minimized, run: () => os.winMin(w.id) },
		{ label: 'Ampliar o restaurar', kbd: 'Alt+↑', run: () => os.winMax(w.id) },
		{ label: 'Abrir otra ventana', run: () => os.openFresh(w.appId) },
		'sep',
		{ label: pinned ? 'Desanclar' : 'Anclar', run: () => pin(w.appId) },
		...toDesktop(w.appId),
		{ label: 'Cerrar ventana', kbd: 'Alt+W', run: () => os.winClose(w.id) }
	];
}

/** Una app anclada sin ventana: abrir o desanclar. */
export function appMenu(appId: string): MenuEntry[] {
	return [
		{ label: 'Abrir', run: () => os.open(appId) },
		'sep',
		{ label: shell.pinned.includes(appId) ? 'Desanclar' : 'Anclar', run: () => pin(appId) },
		...toDesktop(appId)
	];
}

/** «Añadir al escritorio», si aún no tiene acceso allí (la ventana de carpeta no lo lleva). */
function toDesktop(appId: string): MenuEntry[] {
	return appId === 'carpeta' || onDesktop(appId) ? [] : [{ label: 'Añadir al escritorio', run: () => addToDesktop(appId) }];
}
