// Puente entre la shell (este directorio) y el núcleo de Arc OS (src/lib/os/os.svelte.ts): traduce sus apps,
// ventanas y escritorios a la forma mínima de types.ts, y las acciones de la shell a las suyas. Son funciones
// que leen estado reactivo: dentro de un $derived o de la plantilla se actualizan solas.
import { leaveOS } from '../mode.svelte.ts';
import { APPS, appOf, close, desk, focus, focusedWin, goDesk, maximize, minimize, newDesk, openApp, openPath, os } from '../os.svelte.ts';
import { opened } from './shell.svelte.ts';
import type { StartApp } from './start.ts';
import type { DeskInfo, TaskWin } from './types.ts';

export const apps: StartApp[] = APPS.map((a) => ({ id: a.id, title: a.name, code: a.code, icon: a.icon, desc: a.desc }));

export function windows(): TaskWin[] {
	const f = focusedWin();
	return desk()
		.wins.map((w) => ({ w, app: appOf(w) }))
		.filter((x) => !!x.app)
		.map(({ w, app }) => ({ id: w.uid, appId: w.app, title: app!.name, icon: app!.icon, minimized: !!w.min, focused: f?.uid === w.uid && !w.min }));
}

export const desks = (): DeskInfo[] => os.state.desks.map((d) => ({ id: d.id, name: d.name, active: d.id === os.state.active }));

/** La ventana con el foco (para la barra de menús del aspecto Mac). */
export const focused = (): TaskWin | null => windows().find((w) => w.focused) ?? null;

export const status = () => (os.notice && Date.now() - os.notice.at < 8000 ? os.notice.text : null);
export const deskW = () => os.area.w;

export function open(id: string) {
	if (openApp(id)) opened(id);
}
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
export const leave = () => leaveOS();
export const winClose = (uid: string) => close(uid);
export const winMin = (uid: string) => minimize(uid);
export const winMax = (uid: string) => maximize(uid);
export const focusWin = (uid: string) => focus(uid);
