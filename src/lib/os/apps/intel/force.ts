// Simulación de fuerzas del grafo, sin librerías: los nodos se repelen (como cargas), las aristas tiran como
// muelles (más cortos cuanto más pesan) y una gravedad suave los mantiene en el centro. Con unos 100 nodos,
// la repulsión de todos contra todos cuesta poco; no hace falta Barnes-Hut. Pura, con tests.

export interface Body {
	id: string;
	x: number;
	y: number;
	vx: number;
	vy: number;
	/** Radio con el que se pinta (también separa los nodos). */
	r: number;
	/** Lo está arrastrando alguien: no se mueve solo. */
	fixed?: boolean;
}

export interface Spring {
	a: number;
	b: number;
	/** Peso de la arista. */
	w: number;
}

export const SIM = {
	/** Fuerza de repulsión. */
	charge: 900,
	/** Largo de un muelle de peso 1. */
	length: 90,
	/** Rigidez de los muelles. */
	stiffness: 0.04,
	/** Tirón hacia el centro. */
	gravity: 0.012,
	/** Lo que se conserva de la velocidad en cada paso. */
	damping: 0.62,
	/** Velocidad máxima por paso, para que nada salga disparado. */
	maxStep: 24
};

/** Posición inicial estable para un id (espiral de Fermat por orden): el grafo no baila al recargar. */
export function seed(ids: string[], cx = 0, cy = 0, spread = 26): Body[] {
	const golden = Math.PI * (3 - Math.sqrt(5));
	return ids.map((id, i) => ({ id, x: cx + Math.cos(i * golden) * spread * Math.sqrt(i + 1), y: cy + Math.sin(i * golden) * spread * Math.sqrt(i + 1), vx: 0, vy: 0, r: 5 }));
}

/** Un paso de la simulación. `alpha` (0–1) baja con el tiempo: al final casi nada se mueve. */
export function tick(bodies: Body[], springs: Spring[], alpha: number, cx = 0, cy = 0): void {
	const n = bodies.length;
	for (let i = 0; i < n; i++) {
		const p = bodies[i];
		for (let j = i + 1; j < n; j++) {
			const q = bodies[j];
			let dx = p.x - q.x;
			let dy = p.y - q.y;
			let d2 = dx * dx + dy * dy;
			if (d2 < 0.01) {
				// Encima uno del otro: se separan en una dirección fija (según el índice), no al azar.
				dx = Math.cos(i + j);
				dy = Math.sin(i + j);
				d2 = 1;
			}
			const min = p.r + q.r + 6;
			const f = (SIM.charge * alpha) / Math.max(d2, min * min);
			const d = Math.sqrt(d2);
			const fx = (dx / d) * f;
			const fy = (dy / d) * f;
			p.vx += fx;
			p.vy += fy;
			q.vx -= fx;
			q.vy -= fy;
		}
	}
	for (const s of springs) {
		const p = bodies[s.a];
		const q = bodies[s.b];
		const dx = q.x - p.x;
		const dy = q.y - p.y;
		const d = Math.sqrt(dx * dx + dy * dy) || 1;
		const rest = SIM.length / Math.sqrt(1 + Math.log1p(s.w));
		const f = (d - rest) * SIM.stiffness * alpha * Math.min(3, 1 + Math.log1p(s.w) / 2);
		const fx = (dx / d) * f;
		const fy = (dy / d) * f;
		p.vx += fx;
		p.vy += fy;
		q.vx -= fx;
		q.vy -= fy;
	}
	for (const p of bodies) {
		p.vx += (cx - p.x) * SIM.gravity * alpha;
		p.vy += (cy - p.y) * SIM.gravity * alpha;
		if (p.fixed) {
			p.vx = p.vy = 0;
			continue;
		}
		p.vx *= SIM.damping;
		p.vy *= SIM.damping;
		const v = Math.hypot(p.vx, p.vy);
		if (v > SIM.maxStep) {
			p.vx = (p.vx / v) * SIM.maxStep;
			p.vy = (p.vy / v) * SIM.maxStep;
		}
		p.x += p.vx;
		p.y += p.vy;
	}
}

/** Muchos pasos seguidos (sin animación: al reducir el movimiento o para los tests). */
export function settle(bodies: Body[], springs: Spring[], steps = 300, cx = 0, cy = 0): void {
	for (let i = 0; i < steps; i++) tick(bodies, springs, Math.max(0.02, 1 - i / steps), cx, cy);
}

/**
 * El nodo bajo un punto (en coordenadas del grafo), con un margen para el dedo. `scale`: cuánto mide el radio en
 * el grafo (los nodos se pintan a tamaño fijo en la pantalla, así que con zoom es 1 / zoom).
 */
export function hit(bodies: Body[], x: number, y: number, slop = 4, scale = 1): Body | null {
	let best: Body | null = null;
	let bestD = Infinity;
	for (const b of bodies) {
		const d = Math.hypot(b.x - x, b.y - y);
		if (d <= b.r * scale + slop && d < bestD) {
			best = b;
			bestD = d;
		}
	}
	return best;
}
