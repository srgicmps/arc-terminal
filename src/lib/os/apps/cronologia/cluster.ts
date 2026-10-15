// Línea de tiempo (Arc OS): agrupar los sucesos de un carril que, con el zoom de ahora, caerían unos encima
// de otros. Un grupo se pinta como un solo punto con el número de sucesos; al pulsarlo, se listan todos.
import type { Scale } from './scale.ts';
import type { TlEvent } from './events.ts';

export interface Cluster {
	id: string;
	/** Píxel del punto: el del suceso que más pesa del grupo. */
	x: number;
	/** Instante de ese suceso. */
	t: number;
	weight: number;
	/** Sucesos del grupo, del que más pesa al que menos (y, a igual peso, por instante). */
	events: TlEvent[];
}

/** Radio de un punto según su peso (geometría del componente, en px). */
export const radius = (weight: number) => 3 + weight * 6;

/**
 * Agrupa los sucesos visibles (`events` del mismo carril, en cualquier orden): dos sucesos van juntos si
 * sus puntos están a menos de `gap` px. Solo entran los que caen dentro de la escala (con un margen de `gap`).
 */
export function cluster(events: TlEvent[], sc: Scale, gap = 12): Cluster[] {
	const [r0, r1] = sc.range;
	const placed = events
		.map((e) => ({ e, x: sc.x(e.t) }))
		.filter((p) => p.x >= r0 - gap && p.x <= r1 + gap)
		.sort((a, b) => a.x - b.x);
	const out: Cluster[] = [];
	let cur: { xs: number[]; items: { e: TlEvent; x: number }[] } | null = null;
	const close = () => {
		if (!cur) return;
		const items = cur.items.sort((a, b) => b.e.weight - a.e.weight || a.e.t - b.e.t);
		const top = items[0];
		out.push({ id: top.e.id, x: top.x, t: top.e.t, weight: top.e.weight, events: items.map((i) => i.e) });
		cur = null;
	};
	for (const p of placed) {
		if (cur && p.x - cur.xs[cur.xs.length - 1] < gap) {
			cur.xs.push(p.x);
			cur.items.push(p);
		} else {
			close();
			cur = { xs: [p.x], items: [p] };
		}
	}
	close();
	return out;
}

/** El grupo más cercano a `x` (para el cursor y el teclado), si está a menos de `within` px. */
export function nearest(clusters: Cluster[], x: number, within = Infinity): Cluster | null {
	let best: Cluster | null = null;
	for (const c of clusters) if (Math.abs(c.x - x) <= within && (!best || Math.abs(c.x - x) < Math.abs(best.x - x))) best = c;
	return best;
}
