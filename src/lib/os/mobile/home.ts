// Modo OS en el móvil (≤ 900 px), inspirado en un teléfono: pantalla de inicio con rejilla de iconos y widgets,
// dock de 4 apps, páginas con puntos, insignias y multitarea. Lógica pura (sin Svelte), para probarla. Las apps
// salen del registro del núcleo (src/lib/os/apps.ts): vistas, experiencias y herramientas como la Terminal.

import type { OsApp } from '../apps.ts';

/** Lo mínimo de una app para el teléfono (así se prueba sin el registro entero). */
export type PhoneApp = Pick<OsApp, 'id' | 'name' | 'icon'> & Partial<Pick<OsApp, 'href' | 'load' | 'code' | 'desc'>>;

export type WidgetId = 'hoy' | 'mundo' | 'mercados' | 'cripto' | 'bonos' | 'macro' | 'gasolina' | 'avisos';

/** Los widgets que se pueden poner en inicio (modo edición → «+»). El grande ocupa 4×2; los pequeños, 2×2. */
export const WIDGETS: { id: WidgetId; name: string; size: 'l' | 's'; desc: string }[] = [
	{ id: 'hoy', name: 'Hoy', size: 'l', desc: 'Fecha, hora, euríbor y prima de riesgo' },
	{ id: 'mundo', name: 'Mundo', size: 's', desc: 'Hora en Nueva York y Tokio' },
	{ id: 'mercados', name: 'Mercados', size: 's', desc: 'Bitcoin y prima de riesgo' },
	{ id: 'avisos', name: 'Avisos', size: 's', desc: 'Lo último del centro de notificaciones' },
	{ id: 'cripto', name: 'Cripto', size: 's', desc: 'Bitcoin y ether' },
	{ id: 'bonos', name: 'Bonos', size: 's', desc: 'Bono de EE. UU. a 10 años y prima de riesgo' },
	{ id: 'macro', name: 'Macro', size: 's', desc: 'Paro e inflación' },
	{ id: 'gasolina', name: 'Gasolina', size: 's', desc: 'Gasolina 95 y diésel' }
];
export const DEFAULT_WIDGETS: WidgetId[] = ['hoy', 'mundo', 'mercados'];
/** Casillas de la primera página que pueden ocupar los widgets (el resto, apps). */
export const WIDGET_CELLS = 16;
const sizeOf = (id: WidgetId) => WIDGETS.find((w) => w.id === id)?.size ?? 's';
export type Cell =
	| { kind: 'app'; app: PhoneApp }
	| { kind: 'folder'; folder: Folder; apps: PhoneApp[] }
	| { kind: 'widget'; id: WidgetId; size: 'l' | 's' };

/** Rejilla de 4 columnas × 6 filas: un widget grande ocupa 4×2 (8 casillas) y uno pequeño 2×2 (4). */
export const COLS = 4;
export const ROWS = 6;
export const CELLS = COLS * ROWS;
const SIZE = { l: 8, s: 4 } as const;

/** Dock por defecto: 4 apps. Si alguna no existe, se salta. */
export const DOCK = ['top', 'imp', 'ws', 'terminal'] as const;
export const DOCK_MAX = 4;


// ---- Orden y carpetas (como en un teléfono: un solo nivel, sin carpetas dentro de carpetas) ----

/** Una carpeta de la pantalla de inicio: nombre y sus apps, en orden. */
export interface Folder {
	id: string;
	name: string;
	apps: string[];
}
/** Lo que hay en una casilla de inicio: una app (su id) o una carpeta. */
export type Slot = string | Folder;
/** Cómo has colocado el teléfono: inicio en orden y dock. Se guarda en arc-os-phone (va con la cuenta). */
export interface Arrangement {
	items: Slot[];
	dock: string[];
	/** Widgets de la primera página, en orden. */
	widgets: WidgetId[];
}

export const ARRANGE_KEY = 'arc-os-phone';
export const FOLDER_MAX = 16;
export const FOLDER_NAME_MAX = 30;

export const slotKey = (s: Slot) => (typeof s === 'string' ? s : s.id);
const isFolder = (s: Slot): s is Folder => typeof s !== 'string';

/** Una carpeta con una sola app deja de serlo; una vacía desaparece. */
function tidy(items: Slot[]): Slot[] {
	return items.flatMap((s): Slot[] => (isFolder(s) ? (s.apps.length > 1 ? [s] : s.apps) : [s]));
}

/**
 * El orden guardado, puesto al día con las apps que hay: quita las que ya no existen o se repiten y añade al final
 * las nuevas (en el orden del registro). Sin nada guardado, el de siempre.
 */
export function arrange(raw: string | null, ids: string[], dock: readonly string[] = DOCK): Arrangement {
	const known = new Set(ids);
	const seen = new Set<string>();
	const ok = (id: unknown): id is string => typeof id === 'string' && known.has(id) && !seen.has(id) && !!seen.add(id);
	let saved: Partial<Arrangement> | null = null;
	try {
		const v = JSON.parse(raw ?? 'null');
		if (v && typeof v === 'object' && Array.isArray(v.items) && Array.isArray(v.dock)) saved = v;
	} catch {}
	const out: Arrangement = { items: [], dock: [], widgets: [] };
	for (const w of Array.isArray(saved?.widgets) ? saved.widgets : DEFAULT_WIDGETS)
		if (WIDGETS.some((x) => x.id === w) && !out.widgets.includes(w)) out.widgets = addWidget(out, w).widgets;
	for (const id of saved ? saved.dock! : dock) if (out.dock.length < DOCK_MAX && ok(id)) out.dock.push(id);
	const folderIds = new Set<string>();
	for (const s of saved?.items ?? []) {
		if (ok(s)) out.items.push(s);
		else if (s && typeof s === 'object' && typeof s.id === 'string' && Array.isArray(s.apps) && !folderIds.has(s.id)) {
			folderIds.add(s.id);
			const name = typeof s.name === 'string' ? s.name.slice(0, FOLDER_NAME_MAX) : '';
			out.items.push({ id: s.id, name: name || 'Carpeta', apps: s.apps.filter(ok).slice(0, FOLDER_MAX) });
		}
	}
	for (const id of ids) if (ok(id)) out.items.push(id);
	out.items = tidy(out.items);
	return out;
}

/** De dónde sale lo que arrastras: una casilla de inicio, del dock o de dentro de una carpeta. */
export interface Src {
	/** id de la app o de la carpeta. */
	id: string;
	/** Si sale de una carpeta, su id. */
	folder?: string;
}
/** Dónde lo sueltas. */
export type Target =
	| { kind: 'merge'; key: string }
	| { kind: 'before' | 'after'; key: string }
	| { kind: 'end' }
	| { kind: 'dock'; index: number }
	| { kind: 'folder'; folder: string; index: number };

/** Mueve lo que arrastras a donde lo sueltas. Si no se puede (dock lleno, carpeta en carpeta), lo deja como estaba. */
export function place(a: Arrangement, src: Src, to: Target, name = 'Carpeta', newId = `f${Date.now().toString(36)}`): Arrangement {
	let items = a.items.map((s) => (isFolder(s) ? { ...s, apps: [...s.apps] } : s));
	let dock = [...a.dock];
	// Sacarlo de donde está.
	let moving: Slot | undefined;
	if (src.folder) {
		const f = items.find((s): s is Folder => isFolder(s) && s.id === src.folder);
		if (f?.apps.includes(src.id)) {
			f.apps = f.apps.filter((x) => x !== src.id);
			moving = src.id;
		}
	} else if (dock.includes(src.id)) {
		dock = dock.filter((x) => x !== src.id);
		moving = src.id;
	} else {
		moving = items.find((s) => slotKey(s) === src.id);
		items = items.filter((s) => slotKey(s) !== src.id);
	}
	if (moving === undefined) return a;
	const app = typeof moving === 'string' ? moving : null;
	const at = (key: string) => items.findIndex((s) => slotKey(s) === key);

	if (to.kind === 'merge') {
		const i = at(to.key);
		const t = items[i];
		if (i < 0 || !app) return a;
		if (isFolder(t)) {
			if (t.apps.length >= FOLDER_MAX) return a;
			t.apps.push(app);
		} else items[i] = { id: newId, name, apps: [t, app] };
	} else if (to.kind === 'before' || to.kind === 'after') {
		const i = at(to.key);
		if (i < 0) return a;
		items.splice(to.kind === 'before' ? i : i + 1, 0, moving);
	} else if (to.kind === 'end') items.push(moving);
	else if (to.kind === 'dock') {
		if (!app || dock.length >= DOCK_MAX) return a;
		dock.splice(Math.max(0, Math.min(to.index, dock.length)), 0, app);
	} else if (to.kind === 'folder') {
		const f = items.find((s): s is Folder => isFolder(s) && s.id === to.folder);
		if (!f || !app || f.apps.length >= FOLDER_MAX) return a;
		f.apps.splice(Math.max(0, Math.min(to.index, f.apps.length)), 0, app);
	}
	return { items: tidy(items), dock, widgets: a.widgets };
}

/** Saca una app de su carpeta y la deja justo detrás de ella. */
export const takeOut = (a: Arrangement, folder: string, app: string) => place(a, { id: app, folder }, { kind: 'after', key: folder });

export function rename(a: Arrangement, folder: string, name: string): Arrangement {
	const clean = name.replace(/\s+/g, ' ').trim().slice(0, FOLDER_NAME_MAX) || 'Carpeta';
	return { ...a, items: a.items.map((s) => (isFolder(s) && s.id === folder ? { ...s, name: clean } : s)) };
}

/** Casillas que ocupan unos widgets. */
export const widgetCells = (ws: WidgetId[]) => ws.reduce((n, w) => n + SIZE[sizeOf(w)], 0);

/** Pone un widget al final de la primera página, si cabe (no más de WIDGET_CELLS casillas) y no está ya. */
export function addWidget(a: Arrangement, id: WidgetId): Arrangement {
	if (a.widgets.includes(id) || widgetCells([...a.widgets, id]) > WIDGET_CELLS) return a;
	return { ...a, widgets: [...a.widgets, id] };
}
export const removeWidget = (a: Arrangement, id: WidgetId): Arrangement => ({ ...a, widgets: a.widgets.filter((w) => w !== id) });

/** Nombre de una carpeta nueva: la sección del MANUAL si las dos apps la comparten («Mercados»); si no, «Carpeta». */
export const folderName = (sections: (string | undefined)[]) =>
	sections[0] && sections.every((s) => s === sections[0]) ? sections[0] : 'Carpeta';

/**
 * Las páginas de inicio. La primera lleva los widgets entre los iconos, en franjas de 2 filas: un widget grande
 * ocupa una franja; dos pequeños, una (se emparejan en tu orden aunque haya uno grande en medio); uno pequeño suelto,
 * media con 4 apps al lado. La primera franja arriba, dos filas de apps y la otra debajo; lo que sobra, apps. Las
 * siguientes páginas, solo apps. Las del dock no se repiten. Así nada se sale de las 6 filas (con 4 widgets pequeños
 * el último quedaba en una séptima fila, cortado).
 */
export function layout(apps: PhoneApp[], a: Arrangement = arrange(null, apps.map((x) => x.id))): Cell[][] {
	const byId = new Map(apps.map((x) => [x.id, x]));
	const rest: Cell[] = a.items.flatMap((s): Cell[] => {
		if (!isFolder(s)) return byId.has(s) ? [{ kind: 'app', app: byId.get(s)! }] : [];
		const inside = s.apps.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
		return inside.length ? [{ kind: 'folder', folder: s, apps: inside }] : [];
	});
	let i = 0;
	const take = (n: number): Cell[] => rest.slice(i, (i += n));
	const widget = (id: WidgetId): Cell => ({ kind: 'widget', id, size: sizeOf(id) });
	// Franjas: [grande] o [pequeño, pequeño] o [pequeño] (este, con 4 apps al lado).
	const bands: WidgetId[][] = [];
	const smalls = a.widgets.filter((w) => sizeOf(w) === 's');
	for (const w of a.widgets) {
		if (sizeOf(w) === 'l') bands.push([w]);
		else if (smalls[0] === w) bands.push(smalls.splice(0, 2));
	}
	const band = (ws: WidgetId[]): Cell[] => [...ws.map(widget), ...(ws.length === 1 && sizeOf(ws[0]) === 's' ? take(COLS) : [])];
	const first: Cell[] = [];
	const [top, ...more] = bands;
	if (top) first.push(...band(top), ...take(COLS * 2));
	for (const b of more) first.push(...band(b));
	first.push(...take(CELLS - used(first)));
	const pages: Cell[][] = [first];
	while (i < rest.length) pages.push(take(CELLS));
	return pages;
}

/**
 * Filas que ocupa una página en la rejilla de 4 columnas, colocando las casillas como el navegador (auto-placement
 * de CSS Grid, sin `dense`). Sirve para comprobar que nada pasa de ROWS.
 */
export function rowsOf(page: Cell[]): number {
	const taken: boolean[][] = [];
	const free = (r: number, c: number) => !taken[r]?.[c];
	let r = 0;
	let c = 0;
	let rows = 0;
	for (const cell of page) {
		const w = cell.kind === 'widget' ? (cell.size === 'l' ? COLS : 2) : 1;
		const h = cell.kind === 'widget' ? 2 : 1;
		for (;;) {
			if (c + w > COLS) (r++, (c = 0));
			let ok = true;
			for (let y = r; y < r + h && ok; y++) for (let x = c; x < c + w && ok; x++) ok = free(y, x);
			if (ok) break;
			c++;
		}
		for (let y = r; y < r + h; y++) for (let x = c; x < c + w; x++) (taken[y] ??= [])[x] = true;
		rows = Math.max(rows, r + h);
		c += w;
	}
	return rows;
}

/** Casillas que ocupa una página (para comprobar que nada se sale de la rejilla). */
export const used = (page: Cell[]) => page.reduce((n, c) => n + (c.kind === 'widget' ? SIZE[c.size] : 1), 0);

export const dockApps = (apps: PhoneApp[], dock: readonly string[] = DOCK) =>
	dock.map((id) => apps.find((a) => a.id === id)).filter((a): a is PhoneApp => !!a);

// ---- Multitarea: las apps abiertas, de la última a la primera ----

/** Apps que se quedan vivas a la vez (cada una es un iframe: más pesaría demasiado en un móvil). */
/**
 * Una ruta de la web que no es de ninguna app (la ficha de un valor, «/s?sym=NVDA»): se abre igual, a pantalla
 * completa, con una app de paso que no está en inicio. Su id empieza por «web:».
 */
export function webApp(path: string, name?: string): PhoneApp {
	const sym = /^\/s\?sym=([^&#]+)/.exec(path);
	return { id: `web:${path}`, name: name ?? (sym ? decodeURIComponent(sym[1]) : path), icon: '◆', href: path };
}

/**
 * Con el teclado en pantalla, el hueco visible (visualViewport) que debe ocupar el teléfono; null sin teclado o con
 * zoom de pellizco (entonces manda el navegador).
 */
export function keyboardFit(vv: { height: number; offsetTop: number; scale: number }, innerHeight: number): { top: number; h: number } | null {
	return Math.abs(vv.scale - 1) < 0.01 && innerHeight - vv.height > 120 ? { top: vv.offsetTop, h: vv.height } : null;
}

/** Apps abiertas del teléfono en esta pestaña (sessionStorage): sobreviven a una recarga, como en el escritorio. */
export const SESSION_KEY = 'arc-os-phone-session';
/** `entry`: había algo abierto (app, hoja o carpeta), así que la entrada actual del historial es del teléfono. */
export type PhoneSession = { open: string[]; current: string | null; paths: Record<string, string>; names: Record<string, string>; entry: boolean };

/** Lee la sesión guardada: solo apps que existen (`known`) o rutas de paso («web:/s?sym=X»), como mucho MAX_OPEN. */
export function readSession(raw: string | null, known: (id: string) => boolean): PhoneSession {
	const none: PhoneSession = { open: [], current: null, paths: {}, names: {}, entry: false };
	let v: unknown;
	try {
		v = JSON.parse(raw ?? 'null');
	} catch {
		return none;
	}
	if (!v || typeof v !== 'object') return none;
	const o = v as Record<string, unknown>;
	const ok = (id: unknown): id is string => typeof id === 'string' && (known(id) || /^web:\//.test(id));
	const open = (Array.isArray(o.open) ? o.open.filter(ok) : []).filter((id, i, a) => a.indexOf(id) === i).slice(0, MAX_OPEN);
	const strings = (x: unknown) =>
		Object.fromEntries(Object.entries(x && typeof x === 'object' ? x : {}).filter(([k, p]) => open.includes(k) && typeof p === 'string')) as Record<string, string>;
	const paths = Object.fromEntries(Object.entries(strings(o.paths)).filter(([, p]) => p.startsWith('/')));
	return { open, current: ok(o.current) && open.includes(o.current) ? o.current : null, paths, names: strings(o.names), entry: o.entry === true };
}

export const MAX_OPEN = 4;

export function touch(list: string[], id: string, max = MAX_OPEN): string[] {
	return [id, ...list.filter((x) => x !== id)].slice(0, max);
}
export const drop = (list: string[], id: string) => list.filter((x) => x !== id);

// ---- Insignias: lo que no has leído del centro de notificaciones, en la app a la que lleva ----

/**
 * Cada aviso o novedad sin leer cuenta en la app de su enlace (`appOf`: ruta → id de app): los terremotos en GEO,
 * las novedades en NOVEDADES… Todos los avisos cuentan además en AVISOS.
 */
export function badgesFor(
	notices: { id: string; kind: string; href?: string }[],
	seen: Iterable<string>,
	appOf: (href: string) => string | undefined
): Record<string, number> {
	const read = new Set(seen);
	const out: Record<string, number> = {};
	const add = (id: string | undefined) => id && (out[id] = (out[id] ?? 0) + 1);
	for (const n of notices) {
		if (read.has(n.id)) continue;
		if (n.href) add(appOf(n.href));
		if (n.kind === 'aviso') add('avisos');
	}
	return out;
}

/** Los avisos y novedades que se leen al abrir una app (los que cuentan en su insignia). */
export const noticesOf = (notices: { id: string; kind: string; href?: string }[], app: string, appOf: (href: string) => string | undefined) =>
	notices.filter((n) => (n.href && appOf(n.href) === app) || (app === 'avisos' && n.kind === 'aviso')).map((n) => n.id);

/** Lo que se pinta en la insignia: hasta 99. */
export const badgeText = (n: number) => (n > 99 ? '99+' : String(n));

// ---- Gestos ----

export type Edge = 'notif' | 'control' | 'spot' | 'home' | 'switch' | null;

/**
 * Qué hace un deslizamiento. Desde arriba (la barra de estado: `top`, su borde de abajo, con la zona segura del
 * iPhone), a la izquierda, notificaciones; a la derecha, centro de control. En la pantalla de inicio, hacia abajo
 * por el medio, Spotlight. Desde la barra de abajo de una app: corto, a inicio; largo (más de un 35 % de la
 * pantalla) o parando el dedo antes de soltar (`paused`, como en iOS), multitarea.
 */
export function gesture(
	start: { x: number; y: number },
	end: { x: number; y: number },
	size: { w: number; h: number },
	inApp: boolean,
	{ top = 48, paused = false }: { top?: number; paused?: boolean } = {}
): Edge {
	const dx = end.x - start.x;
	const dy = end.y - start.y;
	if (Math.abs(dy) < 50 || Math.abs(dx) > Math.abs(dy)) return null;
	if (start.y < top && dy > 0) return start.x < size.w / 2 ? 'notif' : 'control';
	if (inApp && start.y > size.h - 40 && dy < 0) return -dy > size.h * 0.35 || (paused && -dy > size.h / 10) ? 'switch' : 'home';
	if (!inApp && dy > 0 && start.y >= top) return 'spot';
	return null;
}
