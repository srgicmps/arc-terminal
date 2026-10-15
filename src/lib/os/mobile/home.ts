// Modo OS en el móvil (≤ 900 px), inspirado en un teléfono: pantalla de inicio con rejilla de iconos y widgets,
// dock de 4 apps, páginas con puntos, insignias y multitarea. Lógica pura (sin Svelte), para probarla. Las apps
// salen del registro del núcleo (src/lib/os/apps.ts): vistas, experiencias y herramientas como la Terminal.

import type { OsApp } from '../apps.ts';

/** Lo mínimo de una app para el teléfono (así se prueba sin el registro entero). */
export type PhoneApp = Pick<OsApp, 'id' | 'name' | 'icon'> & Partial<Pick<OsApp, 'href' | 'load' | 'code' | 'desc'>>;

export type WidgetId = 'hoy' | 'mundo' | 'mercados';
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

/**
 * La primera página lleva los widgets entre los iconos (uno grande arriba, dos filas de apps y dos pequeños abajo);
 * las siguientes, solo apps. Las del dock no se repiten.
 */
export const FIRST: (WidgetId | 'apps')[] = ['hoy', 'apps', 'apps', 'mundo', 'mercados'];

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
	const out: Arrangement = { items: [], dock: [] };
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
	return { items: tidy(items), dock };
}

/** Saca una app de su carpeta y la deja justo detrás de ella. */
export const takeOut = (a: Arrangement, folder: string, app: string) => place(a, { id: app, folder }, { kind: 'after', key: folder });

export function rename(a: Arrangement, folder: string, name: string): Arrangement {
	const clean = name.replace(/\s+/g, ' ').trim().slice(0, FOLDER_NAME_MAX) || 'Carpeta';
	return { ...a, items: a.items.map((s) => (isFolder(s) && s.id === folder ? { ...s, name: clean } : s)) };
}

/** Nombre de una carpeta nueva: la sección del MANUAL si las dos apps la comparten («Mercados»); si no, «Carpeta». */
export const folderName = (sections: (string | undefined)[]) =>
	sections[0] && sections.every((s) => s === sections[0]) ? sections[0] : 'Carpeta';

/** Las páginas de inicio: widgets en la primera y, después, las casillas en tu orden. */
export function layout(apps: PhoneApp[], a: Arrangement = arrange(null, apps.map((x) => x.id))): Cell[][] {
	const byId = new Map(apps.map((x) => [x.id, x]));
	const rest: Cell[] = a.items.flatMap((s): Cell[] => {
		if (!isFolder(s)) return byId.has(s) ? [{ kind: 'app', app: byId.get(s)! }] : [];
		const inside = s.apps.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
		return inside.length ? [{ kind: 'folder', folder: s, apps: inside }] : [];
	});
	let i = 0;
	const take = (n: number): Cell[] => rest.slice(i, (i += n));
	const first: Cell[] = [];
	for (const row of FIRST) {
		if (row === 'apps') first.push(...take(COLS));
		else first.push({ kind: 'widget', id: row, size: row === 'hoy' ? 'l' : 's' });
	}
	const pages: Cell[][] = [first];
	while (i < rest.length) pages.push(take(CELLS));
	return pages;
}

/** Casillas que ocupa una página (para comprobar que nada se sale de la rejilla). */
export const used = (page: Cell[]) => page.reduce((n, c) => n + (c.kind === 'widget' ? SIZE[c.size] : 1), 0);

export const dockApps = (apps: PhoneApp[], dock: readonly string[] = DOCK) =>
	dock.map((id) => apps.find((a) => a.id === id)).filter((a): a is PhoneApp => !!a);

/** Buscar (Spotlight): por nombre, código o descripción, sin tildes; primero las que empiezan así. */
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export function findApps(apps: PhoneApp[], q: string, limit = 8): PhoneApp[] {
	const w = fold(q.trim());
	if (!w) return [];
	const score = (a: PhoneApp) => {
		const name = fold(a.name);
		const code = fold(a.code ?? '');
		if (code === w || name === w) return 0;
		if (code.startsWith(w) || name.startsWith(w)) return 1;
		if (name.includes(w) || fold(a.desc ?? '').includes(w)) return 2;
		return -1;
	};
	return apps
		.map((a) => ({ a, s: score(a) }))
		.filter((x) => x.s >= 0)
		.sort((x, y) => x.s - y.s)
		.slice(0, limit)
		.map((x) => x.a);
}

// ---- Multitarea: las apps abiertas, de la última a la primera ----

/** Apps que se quedan vivas a la vez (cada una es un iframe: más pesaría demasiado en un móvil). */
export const MAX_OPEN = 4;

export function touch(list: string[], id: string, max = MAX_OPEN): string[] {
	return [id, ...list.filter((x) => x !== id)].slice(0, max);
}
export const drop = (list: string[], id: string) => list.filter((x) => x !== id);

// ---- Insignias: cuántas cosas nuevas tiene cada app desde que la abriste la última vez ----

/** localStorage: cuándo abriste cada app en el teléfono por última vez ({ id: ms }). */
export const BADGES_KEY = 'arc-os-badges';

export function readSeen(raw: string | null): Record<string, number> {
	try {
		const v = JSON.parse(raw ?? '{}');
		return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
	} catch {
		return {};
	}
}

/**
 * NOVEDADES: cambios fusionados después de la última vez que la abriste. Sin «última vez» (primera vuelta), cuenta
 * los de las últimas 24 h, para no estrenar el teléfono con 40 avisos.
 */
export function badges(changes: { mergedAt: string }[], seen: Record<string, number>, now: number): Record<string, number> {
	const since = seen.novedades ?? now - 24 * 3600_000;
	const n = changes.filter((c) => Date.parse(c.mergedAt) > since).length;
	return n ? { novedades: n } : {};
}

/** Lo que se pinta en la insignia: hasta 99. */
export const badgeText = (n: number) => (n > 99 ? '99+' : String(n));

// ---- Gestos ----

export type Edge = 'notif' | 'control' | 'spot' | 'home' | 'switch' | null;

/**
 * Qué hace un deslizamiento. Desde arriba, a la izquierda, notificaciones; a la derecha, centro de control. En la
 * pantalla de inicio, hacia abajo por el medio, Spotlight. Desde la barra de abajo de una app: corto, a inicio;
 * largo (más de un cuarto de pantalla), multitarea.
 */
export function gesture(
	start: { x: number; y: number },
	end: { x: number; y: number },
	size: { w: number; h: number },
	inApp: boolean
): Edge {
	const dx = end.x - start.x;
	const dy = end.y - start.y;
	if (Math.abs(dy) < 50 || Math.abs(dx) > Math.abs(dy)) return null;
	if (start.y < 48 && dy > 0) return start.x < size.w / 2 ? 'notif' : 'control';
	if (inApp && start.y > size.h - 40 && dy < 0) return -dy > size.h / 4 ? 'switch' : 'home';
	if (!inApp && dy > 0 && start.y > 48) return 'spot';
	return null;
}
