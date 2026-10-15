// Iconos del escritorio de Arc OS: cada uno en una casilla de una rejilla (columna, fila), como en un escritorio
// de verdad. Se arrastran (solos o los seleccionados a la vez) y al soltar caen en la casilla libre más cercana;
// un rectángulo arrastrado sobre el fondo selecciona los que toca. Lógica pura.

export interface Cell {
	col: number;
	row: number;
}
export type Spots = Record<string, Cell>;

/** Tamaño de cada casilla en px según el aspecto (DSM, iconos grandes). */
export const cellSize = (skin: string) => (skin === 'mando' ? { w: 112, h: 128 } : skin === 'dsm' ? { w: 112, h: 120 } : { w: 92, h: 96 });
/** Margen del escritorio hasta la primera casilla. */
export const ORIGIN = 12;

export const cellToPx = (c: Cell, size: { w: number; h: number }) => ({ x: ORIGIN + c.col * size.w, y: ORIGIN + c.row * size.h });

/** La casilla de un punto (px), dentro de `rows` filas y `cols` columnas. */
export function pxToCell(x: number, y: number, size: { w: number; h: number }, cols: number, rows: number): Cell {
	const clamp = (v: number, max: number) => Math.min(Math.max(0, v), Math.max(0, max - 1));
	return { col: clamp(Math.round((x - ORIGIN) / size.w), cols), row: clamp(Math.round((y - ORIGIN) / size.h), rows) };
}

const key = (c: Cell) => `${c.col},${c.row}`;

/**
 * Coloca todos los iconos: los que ya tienen sitio (y cabe) se quedan; los nuevos van a la primera casilla
 * libre, de arriba abajo y de izquierda a derecha (columna a columna, como en Windows o DSM).
 */
export function arrange(ids: string[], saved: Spots, cols: number, rows: number): Spots {
	const out: Spots = {};
	const used = new Set<string>();
	for (const id of ids) {
		const c = saved[id];
		if (c && c.col < cols && c.row < rows && !used.has(key(c))) {
			out[id] = c;
			used.add(key(c));
		}
	}
	for (const id of ids) {
		if (out[id]) continue;
		const free = firstFree(used, cols, rows);
		out[id] = free;
		used.add(key(free));
	}
	return out;
}

function firstFree(used: Set<string>, cols: number, rows: number): Cell {
	for (let col = 0; col < Math.max(1, cols); col++) for (let row = 0; row < Math.max(1, rows); row++) if (!used.has(`${col},${row}`)) return { col, row };
	return { col: 0, row: 0 };
}

/** La casilla libre más cercana a `want` (sin contar las de `except`, que son las que se están moviendo). */
export function nearestFree(want: Cell, spots: Spots, except: string[], cols: number, rows: number): Cell {
	const used = new Set(Object.entries(spots).filter(([id]) => !except.includes(id)).map(([, c]) => key(c)));
	if (!used.has(key(want))) return want;
	let best: Cell = want;
	let dist = Infinity;
	for (let col = 0; col < cols; col++)
		for (let row = 0; row < rows; row++) {
			if (used.has(`${col},${row}`)) continue;
			const d = (col - want.col) ** 2 + (row - want.row) ** 2;
			if (d < dist) (dist = d), (best = { col, row });
		}
	return best;
}

/**
 * Mover un grupo: todos se desplazan lo mismo que el que se arrastra (de `from` a `to`). Cada uno cae en su casilla
 * o, si está ocupada por otro que no se mueve, en la libre más cercana.
 */
export function moveGroup(spots: Spots, ids: string[], from: Cell, to: Cell, cols: number, rows: number): Spots {
	const dc = to.col - from.col;
	const dr = to.row - from.row;
	// Primero se quitan los que se mueven; luego cada uno ocupa su casilla o la libre más cercana.
	const out: Spots = Object.fromEntries(Object.entries(spots).filter(([id]) => !ids.includes(id)));
	for (const id of ids) {
		const c = spots[id];
		if (!c) continue;
		const want = { col: Math.min(Math.max(0, c.col + dc), cols - 1), row: Math.min(Math.max(0, c.row + dr), rows - 1) };
		out[id] = nearestFree(want, out, [], cols, rows);
	}
	return out;
}

/**
 * El icono vecino al pulsar una flecha: el más cercano en esa dirección (misma fila o columna primero). null si no
 * hay ninguno por ese lado.
 */
export function neighbor(spots: Spots, from: string, key: string): string | null {
	const c = spots[from];
	const d = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[key];
	if (!c || !d) return null;
	let best: string | null = null;
	let score = Infinity;
	for (const [id, o] of Object.entries(spots)) {
		const along = (o.col - c.col) * d[0] + (o.row - c.row) * d[1];
		if (id === from || along <= 0) continue;
		const across = Math.abs((o.col - c.col) * d[1]) + Math.abs((o.row - c.row) * d[0]);
		const s = along + across * 4;
		if (s < score) (score = s), (best = id);
	}
	return best;
}

export interface Rect {
	x: number;
	y: number;
	w: number;
	h: number;
}
/** El rectángulo entre dos puntos (se puede arrastrar hacia cualquier lado). */
export const rectOf = (a: { x: number; y: number }, b: { x: number; y: number }): Rect => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) });

/** Los iconos que toca el rectángulo de selección. */
export function inRect(r: Rect, spots: Spots, size: { w: number; h: number }): string[] {
	return Object.entries(spots)
		.filter(([, c]) => {
			const p = cellToPx(c, size);
			return p.x < r.x + r.w && p.x + size.w > r.x && p.y < r.y + r.h && p.y + size.h > r.y;
		})
		.map(([id]) => id);
}

/** Lo guardado (arc-os-icons), validado. */
export function parseSpots(raw: string | null): Spots {
	try {
		const v: unknown = JSON.parse(raw ?? '{}');
		if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
		const out: Spots = {};
		for (const [id, c] of Object.entries(v as Record<string, unknown>)) {
			const cell = c as Cell;
			if (id.length < 80 && cell && Number.isInteger(cell.col) && Number.isInteger(cell.row) && cell.col >= 0 && cell.row >= 0) out[id] = { col: cell.col, row: cell.row };
		}
		return out;
	} catch {
		return {};
	}
}
