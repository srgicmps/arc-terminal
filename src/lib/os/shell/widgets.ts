// Widgets del escritorio de Arc OS (shell): qué hay, dónde está cada uno y cómo se mueven. Lógica pura.

export const WIDGET_KINDS = ['reloj', 'cotizaciones', 'tiempo', 'titulares', 'luz', 'manana'] as const;
export type WidgetKind = (typeof WIDGET_KINDS)[number];

export const WIDGET_LABEL: Record<WidgetKind, string> = {
	reloj: 'Reloj mundial',
	cotizaciones: 'Cotizaciones',
	tiempo: 'Tiempo',
	titulares: 'Titulares',
	luz: 'Luz barata',
	manana: 'Tu mañana'
};

export interface Placed {
	kind: WidgetKind;
	/** Esquina superior izquierda, en px desde la del escritorio. */
	x: number;
	y: number;
}

/** Ancho de un widget y rejilla a la que se ajustan al soltarlos (px de geometría propia). */
export const WIDGET_W = 240;
export const GRID = 8;

/** Los de quien entra por primera vez: a la derecha, en columna. */
export function defaultWidgets(deskW: number): Placed[] {
	const x = Math.max(GRID, deskW - WIDGET_W - 3 * GRID);
	return [
		{ kind: 'reloj', x, y: 2 * GRID },
		{ kind: 'cotizaciones', x, y: 26 * GRID },
		{ kind: 'titulares', x, y: 50 * GRID }
	];
}

/** Al soltar: a la rejilla y dentro del escritorio (siempre queda a la vista un trozo para volver a cogerlo). */
export function snap(p: Placed, deskW: number, deskH: number, h = 120): Placed {
	const r = (v: number) => Math.round(v / GRID) * GRID;
	return {
		...p,
		x: Math.min(Math.max(0, r(p.x)), Math.max(0, deskW - WIDGET_W)),
		y: Math.min(Math.max(0, r(p.y)), Math.max(0, deskH - Math.min(h, 4 * GRID)))
	};
}

/** Mover con el teclado (flechas): un paso de rejilla, o cuatro con Mayúsculas. */
export function nudge(p: Placed, key: string, big: boolean): Placed {
	const d = (big ? 4 : 1) * GRID;
	const dx = key === 'ArrowLeft' ? -d : key === 'ArrowRight' ? d : 0;
	const dy = key === 'ArrowUp' ? -d : key === 'ArrowDown' ? d : 0;
	return { ...p, x: p.x + dx, y: p.y + dy };
}

/** Añadir uno (si no está ya) debajo del último; quitar uno. */
export function addWidget(list: Placed[], kind: WidgetKind, deskW: number): Placed[] {
	if (list.some((w) => w.kind === kind)) return list;
	const x = Math.max(GRID, deskW - WIDGET_W - 3 * GRID);
	const y = list.length ? Math.max(...list.map((w) => w.y)) + 24 * GRID : 2 * GRID;
	return [...list, { kind, x, y }];
}
export const removeWidget = (list: Placed[], kind: WidgetKind) => list.filter((w) => w.kind !== kind);

/** Lo guardado, validado. */
export function parseWidgets(raw: string | null): Placed[] | null {
	try {
		const v: unknown = JSON.parse(raw ?? 'null');
		if (!Array.isArray(v)) return null;
		const ok = v.filter(
			(w): w is Placed =>
				!!w && typeof w === 'object' && (WIDGET_KINDS as readonly string[]).includes((w as Placed).kind) && Number.isFinite((w as Placed).x) && Number.isFinite((w as Placed).y)
		);
		return ok.filter((w, i) => ok.findIndex((o) => o.kind === w.kind) === i).map(({ kind, x, y }) => ({ kind, x, y }));
	} catch {
		return null;
	}
}
