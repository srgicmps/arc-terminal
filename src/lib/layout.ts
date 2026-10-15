// Vista modular: orden, paneles ocultos y ancho de cada panel. Aquí solo la lógica (funciones puras,
// con tests); el estado y el guardado en el navegador están en layout.svelte.ts.

/** Ancho de un panel en columnas de la rejilla modular. */
export type Span = 1 | 2 | 3;

export interface Layout {
	/** Ids de los paneles en el orden en que se ven (también los ocultos). */
	order: string[];
	hidden: string[];
	span: Record<string, Span>;
}

export interface ModuleDef {
	id: string;
	/** Nombre para la lista de ocultos. */
	title: string;
	span?: Span;
}

/** El diseño de fábrica: todos visibles, en el orden en que se declaran. */
export function defaults(modules: readonly ModuleDef[]): Layout {
	return {
		order: modules.map((m) => m.id),
		hidden: [],
		span: Object.fromEntries(modules.map((m) => [m.id, m.span ?? 1]))
	};
}

/**
 * Junta lo guardado con los módulos que existen hoy: los que ya no existen se olvidan y los nuevos
 * se añaden al final, visibles. Si lo guardado está roto, el diseño de fábrica.
 */
export function reconcile(saved: unknown, modules: readonly ModuleDef[]): Layout {
	const base = defaults(modules);
	if (!saved || typeof saved !== 'object') return base;
	const s = saved as Partial<Layout>;
	const known = new Set(base.order);
	const list = (v: unknown) => (Array.isArray(v) ? v.filter((id): id is string => known.has(id)) : []);
	const order = [...new Set(list(s.order))];
	for (const id of base.order) if (!order.includes(id)) order.push(id);
	const span = { ...base.span };
	if (s.span && typeof s.span === 'object') {
		for (const [id, n] of Object.entries(s.span)) if (known.has(id) && (n === 1 || n === 2 || n === 3)) span[id] = n;
	}
	return { order, hidden: [...new Set(list(s.hidden))], span };
}

/** Mueve un panel `delta` puestos entre los visibles (−1 sube, +1 baja). */
export function move(layout: Layout, id: string, delta: number): Layout {
	const visible = layout.order.filter((x) => !layout.hidden.includes(x));
	const from = visible.indexOf(id);
	const to = from + delta;
	if (from < 0 || to < 0 || to >= visible.length) return layout;
	return place(layout, id, visible[to], delta > 0);
}

/** Pone `id` justo antes (o después) de `target`: lo que hace soltar un panel sobre otro. */
export function place(layout: Layout, id: string, target: string, after = false): Layout {
	if (id === target) return layout;
	const order = layout.order.filter((x) => x !== id);
	const at = order.indexOf(target);
	if (at < 0) return layout;
	order.splice(after ? at + 1 : at, 0, id);
	return { ...layout, order };
}

export function hide(layout: Layout, id: string): Layout {
	return layout.hidden.includes(id) ? layout : { ...layout, hidden: [...layout.hidden, id] };
}

export function show(layout: Layout, id: string): Layout {
	return { ...layout, hidden: layout.hidden.filter((x) => x !== id) };
}

export function setSpan(layout: Layout, id: string, span: Span): Layout {
	return { ...layout, span: { ...layout.span, [id]: span } };
}

/** Columnas que caben a este ancho de ventana: los mismos cortes que el CSS de las rejillas (720 y 1100 px). */
export function maxCols(width: number): Span {
	return width && width <= 720 ? 1 : width && width <= 1100 ? 2 : 3;
}

/**
 * Columnas y anchos reales de una rejilla de paneles para que no quede ningún hueco: con pocos paneles, tantas
 * columnas como hagan falta (2 → dos mitades); si un panel no cabe en lo que queda de fila, el anterior se
 * estira hasta el final, y el último también. Los paneles se colocan en orden (sin `dense`).
 */
export function packGrid(spans: readonly Span[], max: Span): { cols: Span; spans: Span[] } {
	const out = spans.map((s) => Math.min(s, max) as Span);
	const total = out.reduce((a, s) => a + s, 0);
	const cols = Math.max(1, Math.min(total, max)) as Span;
	let pos = 0;
	for (let i = 0; i < out.length; i++) {
		if (pos + out[i] > cols) {
			out[i - 1] = (out[i - 1] + cols - pos) as Span;
			pos = 0;
		}
		pos = (pos + out[i]) % cols;
	}
	if (pos && out.length) out[out.length - 1] = (out[out.length - 1] + cols - pos) as Span;
	return { cols, spans: out };
}
