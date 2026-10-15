// Modo OS en el móvil (≤ 900 px), inspirado en un teléfono: pantalla de inicio con rejilla de iconos y widgets,
// dock de 4 apps, páginas con puntos, insignias y multitarea. Lógica pura (sin Svelte), para probarla. Las apps
// salen del registro del núcleo (src/lib/os/apps.ts): vistas, experiencias y herramientas como la Terminal.

import type { OsApp } from '../apps.ts';

/** Lo mínimo de una app para el teléfono (así se prueba sin el registro entero). */
export type PhoneApp = Pick<OsApp, 'id' | 'name' | 'icon'> & Partial<Pick<OsApp, 'href' | 'load' | 'code' | 'desc'>>;

export type WidgetId = 'hoy' | 'mundo' | 'mercados';
export type Cell = { kind: 'app'; app: PhoneApp } | { kind: 'widget'; id: WidgetId; size: 'l' | 's' };

/** Rejilla de 4 columnas × 6 filas: un widget grande ocupa 4×2 (8 casillas) y uno pequeño 2×2 (4). */
export const COLS = 4;
export const ROWS = 6;
export const CELLS = COLS * ROWS;
const SIZE = { l: 8, s: 4 } as const;

/** Dock fijo: 4 apps. Si alguna no existe, se salta. */
export const DOCK = ['top', 'imp', 'ws', 'terminal'] as const;

/**
 * La primera página lleva los widgets entre los iconos (uno grande arriba, dos filas de apps y dos pequeños abajo);
 * las siguientes, solo apps. Las del dock no se repiten.
 */
export const FIRST: (WidgetId | 'apps')[] = ['hoy', 'apps', 'apps', 'mundo', 'mercados'];

export function layout(apps: PhoneApp[], dock: readonly string[] = DOCK): Cell[][] {
	const rest = apps.filter((a) => !dock.includes(a.id));
	let i = 0;
	const take = (n: number): Cell[] => rest.slice(i, (i += n)).map((app) => ({ kind: 'app', app }));
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
export const used = (page: Cell[]) => page.reduce((n, c) => n + (c.kind === 'app' ? 1 : SIZE[c.size]), 0);

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
