// App «Archivos» de Arc OS: el explorador de tus carpetas (el mismo árbol que el escritorio, src/lib/os/fs/) y de lo
// que ya hay en Arc (apps, notas, valores de MIS, escritorios y favoritos). Código en src/lib/os/apps/files/.
// Una sola ventana: abrir una carpeta (openNode) la lleva a ella, con su ruta («/desktop», «/trash», «/<id>»).
import type { ToolApp } from '../apps.ts';
import { folderTitle } from '../fs/desk.ts';
import { APP_KINDS, isSys, locOf, PLACES, SYS_APPS } from './files/explorer.ts';

/** Título de la ventana: la carpeta abierta. */
function title(path: string | undefined): string {
	const loc = locOf(path);
	if (!isSys(loc)) return folderTitle(path);
	const kind = loc.startsWith(`${SYS_APPS}:`) ? APP_KINDS.find((k) => `${SYS_APPS}:${k.id}` === loc) : null;
	return kind?.name ?? PLACES.find((p) => loc === p.id || loc.startsWith(`${p.id}:`))?.name ?? 'Archivos';
}

const app: ToolApp = {
	id: 'archivos',
	name: 'Archivos',
	icon: '🗀',
	desc: 'Explorador: tus carpetas del escritorio y la papelera, y las apps, notas, valores, escritorios y favoritos de Arc',
	load: () => import('./files/Files.svelte'),
	size: { w: 900, h: 580 },
	order: 12,
	title
};

export default app;
