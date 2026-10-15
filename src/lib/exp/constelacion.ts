// Constelación (experiencia 9): quién sale con quién en las noticias. Nodos: valores, líderes, bancos
// centrales, países y unos cuantos temas; una línea entre dos si los nombran los mismos titulares (más gruesa
// cuantos más). Se calcula al construir la web (/data/constelacion.json), con la posición de cada nodo ya
// hecha (una simulación de fuerzas sencilla, sin librerías), así el navegador solo pinta un SVG.
// Lógica pura, sin Svelte ni Vite, para probarla con Vitest.
import { entitiesIn, findEntity } from '../entities.ts';
import { plain } from '../news.ts';
import type { NewsItem } from '../types.ts';

export type Kind = 'valor' | 'lider' | 'banco' | 'pais' | 'tema';

/** Temas que no tienen ficha, por palabras (sin tildes, en español o inglés). */
export const TOPICS: { id: string; label: string; re: RegExp }[] = [
	{ id: 'aranceles', label: 'Aranceles', re: /\b(arancel\w*|tariffs?)\b/i },
	{ id: 'inflacion', label: 'Inflación', re: /\b(inflacion\w*|inflation\w*|IPC|CPI)\b/i },
	{ id: 'tipos', label: 'Tipos de interés', re: /\b(tipos? de interes|interest rates?|rate (cut|hike)s?)\b/i },
	{ id: 'ia', label: 'IA', re: /\b(IA|AI|inteligencia artificial|artificial intelligence|chatbots?|OpenAI|LLMs?)\b/ },
	{ id: 'petroleo', label: 'Petróleo', re: /\b(petroleo|crudo|oil|OPEC|OPEP|Brent)\b/i },
	{ id: 'guerra', label: 'Guerra', re: /\b(guerra|war|ataques?|attacks?|misiles?|missiles?|drones?)\b/i },
	{ id: 'elecciones', label: 'Elecciones', re: /\b(elecciones|electoral|elections?|votes?|votacion)\b/i },
	{ id: 'chips', label: 'Chips', re: /\b(chips?|semiconductor\w*)\b/i },
	{ id: 'vivienda', label: 'Vivienda', re: /\b(vivienda|alquiler\w*|housing|mortgages?|hipotecas?)\b/i },
	{ id: 'cripto', label: 'Cripto', re: /\b(bitcoin|cripto\w*|crypto\w*|stablecoins?)\b/i },
	{ id: 'clima', label: 'Clima', re: /\b(clima\w*|climate|emisiones|emissions|COP\d+)\b/i },
	{ id: 'migracion', label: 'Migración', re: /\b(migra\w*|inmigra\w*|refugiad\w*|refugees?|asylum|asilo)\b/i }
];

export interface GraphNode {
	id: string;
	label: string;
	kind: Kind;
	/** Lo que se busca en NEWS (su ficha). */
	query: string;
	/** Titulares que lo nombran. */
	n: number;
	/** Posición, de 0 a 1. */
	x: number;
	y: number;
	/** Hasta 5 titulares, del más reciente al más antiguo. */
	news: { title: string; url: string; source: string; time: string | null }[];
}

export interface GraphEdge {
	a: string;
	b: string;
	/** Titulares en los que salen juntos. */
	w: number;
}

export interface Graph {
	nodes: GraphNode[];
	edges: GraphEdge[];
	/** Titulares mirados. */
	items: number;
	hours: number;
}

const KIND: Record<string, Kind> = { ticker: 'valor', leader: 'lider', bank: 'banco', country: 'pais' };

/** Lo que nombra un titular: entidades con ficha y temas. */
export function namesIn(text: string): { id: string; label: string; kind: Kind; query: string }[] {
	const out = entitiesIn(text, 20).flatMap((e) => {
		const ent = findEntity(e.query);
		return ent ? [{ id: `${ent.kind}:${e.query}`, label: e.label, kind: KIND[ent.kind], query: e.query }] : [];
	});
	const t = plain(text);
	for (const topic of TOPICS) if (topic.re.test(t)) out.push({ id: `tema:${topic.id}`, label: topic.label, kind: 'tema', query: topic.label });
	return out;
}

/**
 * El grafo de los titulares de las últimas `hours` horas: los `maxNodes` nombres que más salen y las parejas
 * que salen juntas al menos `minEdge` veces (como mucho `maxEdges`, las más fuertes).
 */
export function buildGraph(
	items: NewsItem[],
	now: number,
	{ hours = 72, maxNodes = 48, minEdge = 2, maxEdges = 140 } = {}
): Graph {
	const since = now - hours * 3_600_000;
	const recent = items.filter((i) => i.time && Date.parse(i.time) >= since && Date.parse(i.time) <= now + 3_600_000);
	const nodes = new Map<string, Omit<GraphNode, 'x' | 'y'>>();
	const pairs = new Map<string, number>();
	const seen = new Set<string>();
	for (const item of recent.sort((a, b) => (b.time ?? '').localeCompare(a.time ?? ''))) {
		if (seen.has(item.url)) continue;
		seen.add(item.url);
		const found = namesIn(`${item.title} ${item.titleEs ?? ''}`);
		const ids = [...new Set(found.map((f) => f.id))].sort();
		for (const f of found) {
			if (!nodes.has(f.id)) nodes.set(f.id, { id: f.id, label: f.label, kind: f.kind, query: f.query, n: 0, news: [] });
		}
		for (const id of ids) {
			const node = nodes.get(id)!;
			node.n++;
			if (node.news.length < 5) node.news.push({ title: item.titleEs ?? item.title, url: item.url, source: item.source, time: item.time });
		}
		for (let i = 0; i < ids.length; i++)
			for (let j = i + 1; j < ids.length; j++) pairs.set(`${ids[i]}|${ids[j]}`, (pairs.get(`${ids[i]}|${ids[j]}`) ?? 0) + 1);
	}
	const top = [...nodes.values()].sort((a, b) => b.n - a.n || a.id.localeCompare(b.id)).slice(0, maxNodes);
	const keep = new Set(top.map((n) => n.id));
	const edges = [...pairs]
		.map(([k, w]) => ({ a: k.split('|')[0], b: k.split('|')[1], w }))
		.filter((e) => e.w >= minEdge && keep.has(e.a) && keep.has(e.b))
		.sort((x, y) => y.w - x.w || x.a.localeCompare(y.a) || x.b.localeCompare(y.b))
		.slice(0, maxEdges);
	// Fuera los nodos sueltos (sin ninguna línea): no cuentan nada en una constelación.
	const linked = new Set(edges.flatMap((e) => [e.a, e.b]));
	const kept = top.filter((n) => linked.has(n.id));
	return { nodes: layout(kept, edges), edges, items: seen.size, hours };
}

/** Un número entre 0 y 1 a partir de un texto: posiciones de partida que no cambian de una pasada a otra. */
function hash(s: string): number {
	let h = 2166136261;
	for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
	return ((h >>> 0) % 10_000) / 10_000;
}

/**
 * Disposición por fuerzas (Fruchterman-Reingold, simplificada): los nodos se repelen, las líneas atraen
 * (más cuanto más fuertes) y todo tira un poco hacia el centro. Determinista. Devuelve x, y entre 0,05 y 0,95.
 */
export function layout<T extends { id: string }>(
	nodes: T[],
	edges: GraphEdge[],
	{ iterations = 300, repel = 1, attract = 0.4, gravity = 1 } = {}
): (T & { x: number; y: number })[] {
	const n = nodes.length;
	if (!n) return [];
	const pos = nodes.map((node, i) => {
		const a = 2 * Math.PI * (i / n + hash(node.id) * 0.1);
		const r = 0.25 + 0.2 * hash(`${node.id}r`);
		return { x: 0.5 + r * Math.cos(a), y: 0.5 + r * Math.sin(a) };
	});
	const index = new Map(nodes.map((node, i) => [node.id, i]));
	const links = edges.flatMap((e) => (index.has(e.a) && index.has(e.b) ? [[index.get(e.a)!, index.get(e.b)!, e.w] as const] : []));
	const maxW = Math.max(1, ...links.map((l) => l[2]));
	const k = Math.sqrt(1 / n) * 0.9;
	for (let it = 0; it < iterations; it++) {
		const temp = 0.08 * (1 - it / iterations) + 0.002;
		const d = pos.map(() => ({ x: 0, y: 0 }));
		for (let i = 0; i < n; i++)
			for (let j = i + 1; j < n; j++) {
				let dx = pos[i].x - pos[j].x;
				let dy = pos[i].y - pos[j].y;
				let dist = Math.hypot(dx, dy);
				if (dist < 1e-6) [dx, dy, dist] = [1e-3 * (i - j), 1e-3, 1e-3];
				const f = (repel * k * k) / dist;
				d[i].x += (dx / dist) * f;
				d[i].y += (dy / dist) * f;
				d[j].x -= (dx / dist) * f;
				d[j].y -= (dy / dist) * f;
			}
		for (const [i, j, w] of links) {
			const dx = pos[i].x - pos[j].x;
			const dy = pos[i].y - pos[j].y;
			const dist = Math.max(1e-6, Math.hypot(dx, dy));
			const f = ((attract * dist * dist) / k) * (0.5 + w / maxW);
			d[i].x -= (dx / dist) * f;
			d[i].y -= (dy / dist) * f;
			d[j].x += (dx / dist) * f;
			d[j].y += (dy / dist) * f;
		}
		for (let i = 0; i < n; i++) {
			d[i].x += (0.5 - pos[i].x) * gravity;
			d[i].y += (0.5 - pos[i].y) * gravity;
			const len = Math.max(1e-6, Math.hypot(d[i].x, d[i].y));
			const step = Math.min(len, temp);
			pos[i].x += (d[i].x / len) * step;
			pos[i].y += (d[i].y / len) * step;
		}
	}
	// Encajar en [0,05, 0,95] sin deformar.
	const xs = pos.map((p) => p.x);
	const ys = pos.map((p) => p.y);
	const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
	const span = Math.max(maxX - minX, maxY - minY, 1e-6);
	const round = (v: number) => Math.round(v * 1000) / 1000;
	return nodes.map((node, i) => ({
		...node,
		x: round(0.05 + (0.9 * (pos[i].x - minX + (span - (maxX - minX)) / 2)) / span),
		y: round(0.05 + (0.9 * (pos[i].y - minY + (span - (maxY - minY)) / 2)) / span)
	}));
}

/** Los vecinos de un nodo, de más a menos titulares juntos. */
export function neighbours(id: string, edges: GraphEdge[]): { id: string; w: number }[] {
	return edges
		.flatMap((e) => (e.a === id ? [{ id: e.b, w: e.w }] : e.b === id ? [{ id: e.a, w: e.w }] : []))
		.sort((a, b) => b.w - a.w || a.id.localeCompare(b.id));
}
