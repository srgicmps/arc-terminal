// Arc OS: el gestor de ventanas, en funciones puras (sin Svelte ni navegador, con tests). Cambian el estado
// que reciben (en os.svelte.ts es un $state, así que la vista se entera sola) y devuelven lo que interesa.
// Coordenadas en px dentro del escritorio (el área sin la barra de tareas), con origen arriba a la izquierda.

export interface Rect {
	x: number;
	y: number;
	w: number;
	h: number;
}

/** Mitades, cuartos y pantalla entera. */
export type Snap = 'left' | 'right' | 'top' | 'bottom' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'max';
export const SNAPS: readonly Snap[] = ['left', 'right', 'top', 'bottom', 'top-left', 'top-right', 'bottom-left', 'bottom-right', 'max'];

export interface Win extends Rect {
	/** Único en todo el estado («w7»). */
	uid: string;
	/** id de la app (apps.ts). */
	app: string;
	/** Ruta que enseña ahora, si ha navegado dentro de la ventana (sin ?embed). */
	path?: string;
	/** Orden de apilado: el mayor está delante. */
	z: number;
	min?: boolean;
	/** Encajada a una mitad, un cuarto o maximizada; `restore` es dónde estaba antes. */
	snap?: Snap;
	restore?: Rect;
}

export interface Desk {
	id: string;
	name: string;
	wins: Win[];
}

export interface OsState {
	v: 1;
	desks: Desk[];
	/** id del escritorio que se ve. */
	active: string;
	/** Contador para los uid (no se repiten aunque se cierren ventanas). */
	seq: number;
}

export const MAX_WINS = 12;
export const MAX_DESKS = 6;
export const GRID = 8;
export const MIN_W = 280;
export const MIN_H = 160;
/** Lo que se queda siempre a la vista de una ventana arrastrada fuera (para poder recuperarla). */
export const KEEP = 48;

export const snapTo = (n: number, grid = GRID) => Math.round(n / grid) * grid;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export function emptyState(name = 'Escritorio 1'): OsState {
	return { v: 1, desks: [{ id: 'd1', name, wins: [] }], active: 'd1', seq: 1 };
}

export const activeDesk = (s: OsState): Desk => s.desks.find((d) => d.id === s.active) ?? s.desks[0];
export const findWin = (s: OsState, uid: string): Win | undefined => s.desks.flatMap((d) => d.wins).find((w) => w.uid === uid);
const deskOf = (s: OsState, uid: string) => s.desks.find((d) => d.wins.some((w) => w.uid === uid));
const topZ = (d: Desk) => d.wins.reduce((z, w) => Math.max(z, w.z), 0);

/** La ventana que tiene el foco: la de delante que no está minimizada. */
export function focused(d: Desk): Win | undefined {
	return d.wins.filter((w) => !w.min).sort((a, b) => b.z - a.z)[0];
}

/** Recoloca un rectángulo para que no salga del escritorio (o deje al menos KEEP px a la vista) y lo ajusta a la rejilla. */
export function fit(r: Rect, area: { w: number; h: number }): Rect {
	const w = clamp(snapTo(r.w), MIN_W, Math.max(MIN_W, area.w));
	const h = clamp(snapTo(r.h), MIN_H, Math.max(MIN_H, area.h));
	return { w, h, x: clamp(snapTo(r.x), KEEP - w, Math.max(0, area.w - KEEP)), y: clamp(snapTo(r.y), 0, Math.max(0, area.h - KEEP)) };
}

/** El rectángulo de un encaje en un escritorio de ese tamaño. */
export function snapRect(snap: Snap, area: { w: number; h: number }): Rect {
	const hw = Math.round(area.w / 2);
	const hh = Math.round(area.h / 2);
	const left = snap === 'left' || snap === 'top-left' || snap === 'bottom-left';
	const right = snap === 'right' || snap === 'top-right' || snap === 'bottom-right';
	const top = snap === 'top' || snap === 'top-left' || snap === 'top-right';
	const bottom = snap === 'bottom' || snap === 'bottom-left' || snap === 'bottom-right';
	return {
		x: right ? hw : 0,
		y: bottom ? hh : 0,
		w: left || right ? (right ? area.w - hw : hw) : area.w,
		h: top || bottom ? (bottom ? area.h - hh : hh) : area.h
	};
}

/** Dónde poner una ventana nueva: en cascada desde arriba a la izquierda, 32 px por cada una abierta. */
export function cascade(d: Desk, size: { w: number; h: number }, area: { w: number; h: number }): Rect {
	const n = d.wins.filter((w) => !w.min).length;
	const step = 32;
	const w = Math.min(size.w, area.w);
	const h = Math.min(size.h, area.h);
	const room = Math.max(1, Math.floor(Math.min(area.w - w, area.h - h) / step) + 1);
	const off = (n % room) * step;
	return fit({ x: 24 + off, y: 16 + off, w, h }, area);
}

export type OpenResult = { win: Win; created: boolean } | { win: null; reason: 'tope' };

/**
 * Abre una app en el escritorio activo. Si es de una sola ventana y ya está abierta, la trae al frente.
 * Con MAX_WINS ventanas en el escritorio, no abre nada (reason «tope»).
 */
export function openWin(s: OsState, app: { id: string; size: { w: number; h: number }; single?: boolean }, area: { w: number; h: number }, path?: string): OpenResult {
	const d = activeDesk(s);
	const open = d.wins.find((w) => w.app === app.id);
	if (open && app.single !== false) {
		if (path) open.path = path;
		focusWin(s, open.uid);
		return { win: open, created: false };
	}
	if (d.wins.length >= MAX_WINS) return { win: null, reason: 'tope' };
	const win: Win = { uid: `w${s.seq++}`, app: app.id, z: topZ(d) + 1, ...cascade(d, app.size, area), ...(path ? { path } : {}) };
	d.wins.push(win);
	return { win, created: true };
}

export function closeWin(s: OsState, uid: string): void {
	const d = deskOf(s, uid);
	if (d) d.wins = d.wins.filter((w) => w.uid !== uid);
}

/** Al frente (y la saca de minimizada). Renumera z para que no crezca sin fin. */
export function focusWin(s: OsState, uid: string): void {
	const d = deskOf(s, uid);
	const w = d?.wins.find((x) => x.uid === uid);
	if (!d || !w) return;
	w.min = false;
	if (s.active !== d.id) s.active = d.id;
	const others = d.wins.filter((x) => x !== w).sort((a, b) => a.z - b.z);
	others.forEach((x, i) => (x.z = i + 1));
	w.z = others.length + 1;
}

export function minimizeWin(s: OsState, uid: string): void {
	const w = findWin(s, uid);
	if (w) w.min = true;
}

/** Mueve o redimensiona a mano: deja de estar encajada. */
export function placeWin(s: OsState, uid: string, r: Rect, area: { w: number; h: number }): void {
	const w = findWin(s, uid);
	if (!w) return;
	Object.assign(w, fit(r, area));
	delete w.snap;
	delete w.restore;
}

/** Encaja a una mitad, un cuarto o a pantalla entera; el mismo encaje otra vez (o null) la devuelve a donde estaba. */
export function snapWin(s: OsState, uid: string, snap: Snap | null, area: { w: number; h: number }): void {
	const w = findWin(s, uid);
	if (!w) return;
	if (snap === null || w.snap === snap) {
		if (w.restore) Object.assign(w, fit(w.restore, area));
		delete w.snap;
		delete w.restore;
		return;
	}
	if (!w.snap) w.restore = { x: w.x, y: w.y, w: w.w, h: w.h };
	w.snap = snap;
	Object.assign(w, snapRect(snap, area));
}

export const toggleMax = (s: OsState, uid: string, area: { w: number; h: number }) => snapWin(s, uid, 'max', area);

/** Al cambiar el tamaño del escritorio: los encajes se recalculan y las demás vuelven dentro. */
export function relayout(s: OsState, area: { w: number; h: number }): void {
	for (const d of s.desks)
		for (const w of d.wins) {
			if (w.snap) Object.assign(w, snapRect(w.snap, area));
			else Object.assign(w, fit(w, area));
		}
}

/** Alt+Tab: la siguiente ventana por orden de uso (dir 1) o la anterior (-1), incluidas las minimizadas. */
export function cycleWin(s: OsState, dir: 1 | -1 = 1): Win | undefined {
	const d = activeDesk(s);
	const byUse = [...d.wins].sort((a, b) => b.z - a.z);
	if (byUse.length < 2) return byUse[0];
	const next = dir === 1 ? byUse[1] : byUse[byUse.length - 1];
	focusWin(s, next.uid);
	return next;
}

// ── Escritorios ──

export function addDesk(s: OsState, name?: string): Desk | null {
	if (s.desks.length >= MAX_DESKS) return null;
	let n = s.desks.length + 1;
	while (s.desks.some((d) => d.id === `d${n}`)) n++;
	const desk: Desk = { id: `d${n}`, name: name?.trim() || `Escritorio ${s.desks.length + 1}`, wins: [] };
	s.desks.push(desk);
	s.active = desk.id;
	return desk;
}

export function renameDesk(s: OsState, id: string, name: string): void {
	const d = s.desks.find((x) => x.id === id);
	const clean = name.trim().slice(0, 40);
	if (d && clean) d.name = clean;
}

/** Quita un escritorio (nunca el último); sus ventanas pasan al de al lado. */
export function removeDesk(s: OsState, id: string): void {
	const i = s.desks.findIndex((d) => d.id === id);
	if (i < 0 || s.desks.length < 2) return;
	const [gone] = s.desks.splice(i, 1);
	const to = s.desks[Math.max(0, i - 1)];
	const z = topZ(to);
	for (const w of gone.wins.slice(0, Math.max(0, MAX_WINS - to.wins.length))) to.wins.push({ ...w, z: z + w.z });
	if (s.active === id) s.active = to.id;
}

export function switchDesk(s: OsState, id: string): void {
	if (s.desks.some((d) => d.id === id)) s.active = id;
}

/** Pasa una ventana a otro escritorio (si cabe). */
export function moveToDesk(s: OsState, uid: string, id: string): boolean {
	const from = deskOf(s, uid);
	const to = s.desks.find((d) => d.id === id);
	if (!from || !to || from === to || to.wins.length >= MAX_WINS) return false;
	const w = from.wins.find((x) => x.uid === uid)!;
	from.wins = from.wins.filter((x) => x !== w);
	to.wins.push({ ...w, z: topZ(to) + 1 });
	return true;
}

// ── Lo guardado ──

const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : d);

/** Lo guardado, limpio: sin apps que ya no existen, sin uid repetidos, con números válidos y topes. */
export function reconcileOs(saved: unknown, known: (id: string) => boolean): OsState {
	const s = saved as Partial<OsState> | null;
	if (!s || typeof s !== 'object' || !Array.isArray(s.desks) || !s.desks.length) return emptyState();
	const out: OsState = { v: 1, desks: [], active: '', seq: Math.max(1, num(s.seq, 1)) };
	const uids = new Set<string>();
	const ids = new Set<string>();
	for (const raw of s.desks.slice(0, MAX_DESKS)) {
		const d = raw as Partial<Desk>;
		const id = typeof d?.id === 'string' && /^d\d{1,3}$/.test(d.id) && !ids.has(d.id) ? d.id : null;
		if (!id) continue;
		ids.add(id);
		const wins: Win[] = [];
		for (const rw of Array.isArray(d.wins) ? d.wins : []) {
			const w = rw as Partial<Win>;
			if (typeof w?.uid !== 'string' || uids.has(w.uid) || typeof w.app !== 'string' || !known(w.app) || wins.length >= MAX_WINS) continue;
			uids.add(w.uid);
			const n = Number(w.uid.slice(1));
			if (Number.isFinite(n) && n >= out.seq) out.seq = n + 1;
			const win: Win = { uid: w.uid, app: w.app, x: num(w.x, 24), y: num(w.y, 16), w: Math.max(MIN_W, num(w.w, 880)), h: Math.max(MIN_H, num(w.h, 600)), z: num(w.z, 1) };
			if (typeof w.path === 'string' && w.path.startsWith('/') && w.path.length < 300) win.path = w.path;
			if (w.min === true) win.min = true;
			if (typeof w.snap === 'string' && SNAPS.includes(w.snap)) {
				win.snap = w.snap;
				const r = w.restore as Partial<Rect> | undefined;
				if (r) win.restore = { x: num(r.x, 24), y: num(r.y, 16), w: num(r.w, 880), h: num(r.h, 600) };
			}
			wins.push(win);
		}
		out.desks.push({ id, name: typeof d.name === 'string' && d.name.trim() ? d.name.trim().slice(0, 40) : `Escritorio ${out.desks.length + 1}`, wins });
	}
	if (!out.desks.length) return emptyState();
	out.active = out.desks.some((d) => d.id === s.active) ? (s.active as string) : out.desks[0].id;
	return out;
}
