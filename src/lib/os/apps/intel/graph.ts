// Consultas sobre el grafo de entidades: vecinos, vista inicial, expandir, filtrar y buscar. Puras, con tests.
import { fold } from '../../../search.ts';
import { WHY, isKind, nodeId, type Graph, type IntelEdge, type IntelNode, type Kind, type Why } from './model.ts';

export interface Neighbor {
	node: IntelNode;
	edge: IntelEdge;
}

/** Vecinos de un nodo, de la arista más fuerte a la más débil (y, a igualdad, el más nombrado). */
export function neighbors(g: Graph, id: string, opts: { max?: number; kinds?: readonly Kind[] } = {}): Neighbor[] {
	const out: Neighbor[] = [];
	for (const [other, edge] of g.adj.get(id) ?? []) {
		const node = g.nodes.get(other);
		if (node && (!opts.kinds || opts.kinds.includes(node.kind))) out.push({ node, edge });
	}
	out.sort((a, b) => b.edge.w - a.edge.w || b.node.mentions - a.node.mentions || a.node.label.localeCompare(b.node.label));
	return opts.max ? out.slice(0, opts.max) : out;
}

/** Fuerza de un nodo: la suma de los pesos de sus aristas más lo que se le nombra. */
export function strength(g: Graph, id: string): number {
	let s = g.nodes.get(id)?.mentions ?? 0;
	for (const e of g.adj.get(id)?.values() ?? []) s += e.w;
	return s;
}

/** Por qué se enlazan, en palabras: «en los mismos titulares (5) · país». */
export function whyText(e: IntelEdge): string {
	return (Object.entries(e.why) as [Why, number][])
		.sort((a, b) => b[1] - a[1])
		.map(([k, n]) => (n > 1 ? `${WHY[k]} (${n})` : WHY[k]))
		.join(' · ');
}

/**
 * Lo que se ve al abrir el grafo: los `max` nodos con más fuerza de los tipos elegidos, contando solo las
 * aristas que no son de estructura (así la vista inicial es la de la actualidad, no la de los registros).
 */
export function overview(g: Graph, kinds: readonly Kind[], max = 48): Set<string> {
	const score = new Map<string, number>();
	for (const e of g.edges.values()) {
		const live = e.w - (e.why.cargo ?? 0) * 2 - (e.why.banco ?? 0) * 2 - (e.why.pais ?? 0);
		if (live <= 0) continue;
		for (const id of [e.a, e.b]) score.set(id, (score.get(id) ?? 0) + live);
	}
	const list = [...score.entries()]
		.filter(([id]) => kinds.includes(g.nodes.get(id)!.kind))
		.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
		.slice(0, max)
		.map(([id]) => id);
	return new Set(list);
}

/** Un nodo y sus `max` vecinos más fuertes (de los tipos elegidos). */
export function ego(g: Graph, id: string, kinds: readonly Kind[], max = 16): Set<string> {
	const out = new Set<string>([id]);
	for (const n of neighbors(g, id, { kinds, max })) out.add(n.node.id);
	return out;
}

/** Añade a lo visible los vecinos más fuertes de `id` que aún no estaban (doble clic). */
export function expand(g: Graph, visible: ReadonlySet<string>, id: string, kinds: readonly Kind[], max = 12): Set<string> {
	const out = new Set(visible);
	out.add(id);
	for (const n of neighbors(g, id, { kinds }).filter((n) => !visible.has(n.node.id)).slice(0, max)) out.add(n.node.id);
	return out;
}

/** Aristas entre los nodos visibles. */
export function edgesAmong(g: Graph, ids: ReadonlySet<string>): IntelEdge[] {
	const out: IntelEdge[] = [];
	for (const id of ids) for (const [other, e] of g.adj.get(id) ?? []) if (id < other && ids.has(other)) out.push(e);
	return out;
}

/** Buscar por nombre, código o alias: primero lo que empieza igual, luego lo más nombrado. */
export function searchNodes(g: Graph, q: string, max = 12): IntelNode[] {
	const words = fold(q).trim().split(/\s+/).filter(Boolean);
	if (!words.length) return [];
	const hits: { n: IntelNode; rank: number }[] = [];
	for (const n of g.nodes.values()) {
		if (!words.every((w) => n.terms.includes(w))) continue;
		const terms = n.terms.split(' | ');
		const rank = terms.includes(words.join(' ')) ? 0 : terms.some((t) => t.startsWith(words[0])) ? 1 : 2;
		hits.push({ n, rank });
	}
	const fixed = (k: Kind) => (k === 'country' || k === 'leader' || k === 'bank' || k === 'ticker' ? 0 : 1);
	hits.sort((a, b) => a.rank - b.rank || fixed(a.n.kind) - fixed(b.n.kind) || b.n.mentions - a.n.mentions || a.n.label.localeCompare(b.n.label));
	return hits.slice(0, max).map((h) => h.n);
}

/** El id de un nodo a partir del path de la ventana («/expediente#country:ES»), o null. */
export function targetOf(path: string | null | undefined): string | null {
	const hash = path?.split('#')[1];
	if (!hash) return null;
	const i = hash.indexOf(':');
	if (i < 1) return null;
	const kind = hash.slice(0, i);
	if (!isKind(kind)) return null;
	try {
		const key = decodeURIComponent(hash.slice(i + 1));
		return key ? nodeId(kind, key) : null;
	} catch {
		return null;
	}
}

/** El path de una ventana que apunta a un nodo: «/expediente#country:ES». */
export function pathTo(app: 'expediente' | 'grafo', id: string | null): string {
	if (!id) return `/${app}`;
	const i = id.indexOf(':');
	return `/${app}#${id.slice(0, i)}:${encodeURIComponent(id.slice(i + 1))}`;
}
