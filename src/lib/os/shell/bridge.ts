// Puente entre la shell (este directorio) y el núcleo de Arc OS (src/lib/os/os.svelte.ts): traduce sus apps,
// ventanas y escritorios a la forma mínima de types.ts, y las acciones de la shell a las suyas. Son funciones
// que leen estado reactivo: dentro de un $derived o de la plantilla se actualizan solas.
import { isInstalled } from '../packages.svelte.ts';
import { leaveOS } from '../mode.svelte.ts';
import { APPS, appOf, close, desk, focus, focusedWin, goDesk, maximize, minimize, newDesk, openApp, openPath, os, removeDesk, tile } from '../os.svelte.ts';
import { MAX_DESKS } from '../wm.ts';
import { opened } from './shell.svelte.ts';
import type { StartApp } from './start.ts';
import type { DeskInfo, TaskWin } from './types.ts';

export const apps: StartApp[] = APPS.map((a) => ({ id: a.id, title: a.name, code: a.code, icon: a.icon, desc: a.desc }));
/** Las que están instaladas (Centro de paquetes de «OS 4»): las listas de la shell usan estas. */
export const installed = () => apps.filter((a) => isInstalled(a.id));

export function windows(): TaskWin[] {
	const f = focusedWin();
	return desk()
		.wins.map((w) => ({ w, app: appOf(w) }))
		.filter((x) => !!x.app)
		.map(({ w, app }) => ({ id: w.uid, appId: w.app, title: app!.title?.(w.path) ?? app!.name, icon: app!.icon, minimized: !!w.min, focused: f?.uid === w.uid && !w.min }));
}

export const desks = (): DeskInfo[] => os.state.desks.map((d) => ({ id: d.id, name: d.name, active: d.id === os.state.active }));

/** La ventana con el foco (para la barra de menús del aspecto Mac). */
export const focused = (): TaskWin | null => windows().find((w) => w.focused) ?? null;

export const status = () => (os.notice && Date.now() - os.notice.at < 8000 ? os.notice.text : null);
export const deskW = () => os.area.w;
export const deskH = () => os.area.h;

export function open(id: string) {
	if (openApp(id)) opened(id);
}
/** Una app en un sitio concreto (Ajustes en una sección: `openAt('ajustes', 'cuenta')`). */
export function openAt(id: string, path: string) {
	if (openApp(id, path)) opened(id);
}
/** Otra ventana de la misma app, aunque ya haya una. */
export function openFresh(id: string) {
	if (openApp(id, undefined, true)) opened(id);
}
export const tileWins = () => void tile();
/** Tocar la ventana que está delante la minimiza; cualquier otra, la trae al frente (y la restaura). */
export function activate(uid: string) {
	const f = focusedWin();
	if (f?.uid === uid && !f.min) minimize(uid);
	else focus(uid);
}
export function navigate(href: string) {
	const win = openPath(href);
	if (win) opened(win.app);
	else if (/^https?:/.test(href)) window.open(href, '_blank', 'noopener');
}
export const switchDesk = (id: string) => goDesk(id);
export const addDesk = () => void newDesk();
export const canAddDesk = () => os.state.desks.length < MAX_DESKS;
/** Quita un escritorio; sus ventanas pasan al de al lado (núcleo). */
export const closeDesk = (id: string) => removeDesk(id);
export const leave = () => leaveOS();
export const winClose = (uid: string) => close(uid);
export const winMin = (uid: string) => minimize(uid);
export const winMax = (uid: string) => maximize(uid);
export const focusWin = (uid: string) => focus(uid);

let hidden: string[] = [];
/**
 * «Mostrar escritorio»: minimiza todas las ventanas a la vista; si ya no había ninguna, devuelve las que se
 * escondieron así (como el botón de la esquina de Windows o el de DSM).
 */
export function showDesktop() {
	const visible = desk().wins.filter((w) => !w.min);
	if (visible.length) {
		hidden = visible.map((w) => w.uid);
		for (const w of visible) minimize(w.uid);
	} else {
		for (const uid of hidden) focus(uid);
		hidden = [];
	}
}
