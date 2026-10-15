// Arc OS en el navegador: el estado de los escritorios (un $state, como un reactive() de Vue) y las acciones que
// usan las ventanas, la barra de tareas, el menú Inicio y la terminal. La lógica está en wm.ts; aquí solo se
// guarda (localStorage «arc-os-desks», que se sincroniza con la cuenta) y se lleva el tamaño del escritorio.
//
// API para las otras piezas de Arc OS (OS 2 escritorio y barra, OS 3 móvil y terminal):
//   os.state            escritorios y ventanas (solo leer; para cambiar, las funciones de abajo)
//   os.area             tamaño del escritorio en px (lo pone WindowLayer)
//   desk()              el escritorio que se ve · focusedWin() la ventana con el foco
//   openApp(id, path?, fresh?)  abre (o trae al frente) una app; null si hay MAX_WINS ventanas (os.notice lo explica)
//   openPath('/eco')    abre la app de una ruta de la web, con esa ruta
//   focus · close (animada) · toggleTop (siempre encima) · minimize · maximize · snap · place · cycle · tile (mosaico) · nudge (teclado)
//   newDesk · rename · removeDesk · goDesk · sendToDesk
// El modo (Terminal clásico ↔ Modo OS, clave arc-shell) lo lleva src/lib/os/mode.svelte.ts (OS 3).
import { APPS, appOfPath, findApp, type OsApp } from './apps.ts';
import { logSession } from './apps/logs/session.svelte.ts';
import * as wm from './wm.ts';

export const OS_KEY = 'arc-os-desks';

const known = (id: string) => !!findApp(id);

export const os = $state({
	state: wm.emptyState(),
	area: { w: 1280, h: 720 },
	/** Último aviso para quien use la API (p. ej. «Hay 12 ventanas…»); la barra de OS 2 lo enseña. */
	notice: null as { text: string; at: number } | null,
	/** Ventanas que se están cerrando (la animación; luego se quitan). No se guarda. */
	closing: [] as string[],
	loaded: false
});

export const desk = () => wm.activeDesk(os.state);
export const focusedWin = () => wm.focused(desk());
export const appOf = (w: wm.Win): OsApp | undefined => findApp(w.app);
export { APPS };

/** Lee lo guardado. Se llama al montar /os (y lo puede llamar quien necesite el estado antes). */
export function loadOs() {
	if (os.loaded) return;
	try {
		const raw = localStorage.getItem(OS_KEY);
		os.state = wm.reconcileOs(raw ? JSON.parse(raw) : null, known);
	} catch {
		os.state = wm.emptyState();
	}
	os.loaded = true;
}

let timer: ReturnType<typeof setTimeout> | undefined;
/** Guarda poco después del último cambio (al arrastrar no se escribe en cada movimiento). */
export function persist() {
	clearTimeout(timer);
	timer = setTimeout(() => {
		try {
			localStorage.setItem(OS_KEY, JSON.stringify($state.snapshot(os.state)));
		} catch {}
	}, 300);
}

const say = (text: string) => (os.notice = { text, at: Date.now() });

const done = <T>(v: T): T => (persist(), v);

/** Abre una app (o la trae al frente). `fresh`: otra ventana de la misma app («Nueva ventana»). */
export function openApp(id: string, path?: string, fresh = false): wm.Win | null {
	const app = findApp(id);
	if (!app) return null;
	const r = wm.openWin(os.state, app, os.area, path, fresh);
	if (!r.win) {
		say(`Hay ${wm.MAX_WINS} ventanas en este escritorio: cierra alguna o abre otro escritorio.`);
		return null;
	}
	if (r.created) logSession('abre', app.name);
	return done(r.win);
}

/** Abre la app de una ruta de la web («/eco?x=1», «/x/zen»). null si la ruta no es de ninguna app. */
export function openPath(path: string): wm.Win | null {
	const app = appOfPath(path);
	return app ? openApp(app.id, path === app.href ? undefined : path) : null;
}

export const focus = (uid: string) => done(wm.focusWin(os.state, uid));
/** Cerrar: la ventana se anima (--os-anim-close) y luego se quita con closeNow. */
export function close(uid: string) {
	if (!os.closing.includes(uid)) os.closing.push(uid);
}
/** Quita la ventana ya (lo llama la ventana al acabar la animación de cierre). */
export function closeNow(uid: string) {
	os.closing = os.closing.filter((u) => u !== uid);
	const w = wm.findWin(os.state, uid);
	if (w) logSession('cierra', appOf(w)?.name ?? w.app);
	done(wm.closeWin(os.state, uid));
}
export const toggleTop = (uid: string) => done(wm.toggleTop(os.state, uid));
export const minimize = (uid: string) => done(wm.minimizeWin(os.state, uid));
export const maximize = (uid: string) => done(wm.toggleMax(os.state, uid, os.area));
export const snap = (uid: string, to: wm.Snap | null) => done(wm.snapWin(os.state, uid, to, os.area));
export const place = (uid: string, r: wm.Rect) => done(wm.placeWin(os.state, uid, r, os.area));
export const cycle = (dir: 1 | -1 = 1) => done(wm.cycleWin(os.state, dir));
/** Mosaico: todas las ventanas a la vista, en rejilla (el «escritorio en rejilla» de DASH). */
export const tile = () => done(wm.tileDesk(os.state, os.area));
export const nudge = (uid: string, dx: number, dy: number, resize = false) => done(wm.nudgeWin(os.state, uid, dx, dy, resize, os.area));
/** La ruta que enseña ahora una ventana (la apunta la propia ventana al navegar dentro). */
export function setPath(uid: string, path: string) {
	const w = wm.findWin(os.state, uid);
	if (w && w.path !== path) done((w.path = path));
}

export function newDesk(name?: string) {
	const d = wm.addDesk(os.state, name);
	if (!d) say(`Como mucho ${wm.MAX_DESKS} escritorios.`);
	return done(d);
}
export const rename = (id: string, name: string) => done(wm.renameDesk(os.state, id, name));
export const removeDesk = (id: string) => done(wm.removeDesk(os.state, id));
export const goDesk = (id: string) => done(wm.switchDesk(os.state, id));
export function sendToDesk(uid: string, id: string) {
	if (!wm.moveToDesk(os.state, uid, id)) say('No cabe en ese escritorio.');
	persist();
}

let measured = false;
/** El escritorio ha cambiado de tamaño (lo llama WindowLayer). */
export function setArea(w: number, h: number) {
	if (w < 1 || h < 1 || (w === os.area.w && h === os.area.h)) return;
	// Lo que se veía entero se sigue viendo entero al hacer zoom o encoger el navegador (la primera medida no
	// tiene un tamaño de antes: 1280 × 720 es solo el valor de partida).
	const prev = measured ? os.area : undefined;
	measured = true;
	os.area = { w, h };
	wm.relayout(os.state, os.area, prev);
	persist();
}
