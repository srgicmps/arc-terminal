// Globo 3D (GLOBO): las cuentas, sin DOM. Proyección ortográfica (la de una foto de la Tierra desde lejos), como
// la de d3-geo pero sin dependencia: girar, pasar de la pantalla al globo, tierra en puntos y qué punto se toca.
// El dibujo está en globe-render.ts, que se carga solo al abrir el globo. Funciones puras, con tests.
import type { MapPoint } from './layers.ts';

/** Un punto del globo: los de GEO y los de la Sala de control, con cualquier capa. */
export interface GlobePoint extends Omit<MapPoint, 'layer'> {
	layer: string;
	/** Cuándo pasó (ISO 8601), si se sabe. */
	t?: string | null;
}

/** Hacia dónde mira el globo: el punto del centro, en grados. */
export interface View {
	lon: number;
	lat: number;
}

/** Capas del globo: las de la Sala de control y, además, avisos a barcos y sanciones de GEO. */
export const GLOBE_LAYERS = [
	{ value: 'conflict', label: 'Conflictos' },
	{ value: 'quakes', label: 'Terremotos' },
	{ value: 'disasters', label: 'Catástrofes' },
	{ value: 'travel', label: 'Avisos de viaje' },
	{ value: 'elections', label: 'Elecciones' },
	{ value: 'internet', label: 'Cortes de internet' },
	{ value: 'airspace', label: 'Espacio aéreo' },
	{ value: 'maritime', label: 'Avisos a barcos' },
	{ value: 'straits', label: 'Estrechos' },
	{ value: 'sanctions', label: 'Sanciones' }
] as const;

export type Shape = 'circle' | 'diamond' | 'square' | 'triangle';

/**
 * Cómo se pinta cada capa: forma y tokens de color (sin el «--»), los mismos que el mapa de GEO y la Sala.
 * `fill` vacío: solo el borde. Las capas que no están aquí, como un círculo ámbar suave.
 */
export const LAYER_STYLE: Record<string, { shape: Shape; fill?: string; stroke?: string; dash?: boolean }> = {
	conflict: { shape: 'circle', fill: 'amber-edge', stroke: 'amber' },
	quakes: { shape: 'circle', fill: 'amber-soft', stroke: 'amber' },
	storms: { shape: 'circle', stroke: 'fg' },
	events: { shape: 'circle', fill: 'muted' },
	disasters: { shape: 'circle', fill: 'amber-soft', stroke: 'amber-dim' },
	travel: { shape: 'diamond', fill: 'amber-soft', stroke: 'amber-dim' },
	elections: { shape: 'square', stroke: 'fg' },
	internet: { shape: 'triangle', stroke: 'fg' },
	airspace: { shape: 'circle', stroke: 'amber', dash: true },
	maritime: { shape: 'circle', fill: 'amber-soft' },
	straits: { shape: 'circle', stroke: 'amber' },
	sanctions: { shape: 'diamond', fill: 'amber-soft', stroke: 'amber' }
};
export const styleOf = (layer: string) =>
	LAYER_STYLE[layer] ?? { shape: 'circle' as const, fill: 'amber-soft', stroke: 'amber' };

const RAD = Math.PI / 180;

/** Longitud entre −180 y 180. */
export const wrapLon = (lon: number) => ((((lon + 180) % 360) + 360) % 360) - 180;
/** La latitud del centro no pasa de ±80: el globo nunca se pone boca abajo. */
export const clampLat = (lat: number) => Math.max(-80, Math.min(80, lat));

/**
 * Un punto del globo en coordenadas de la esfera girada: `x` y `y` en la pantalla (radio 1, y hacia arriba) y
 * `z`, la profundidad (1 = en el centro, mirando de frente; < 0 = por detrás, no se ve).
 */
export function rotate(lat: number, lon: number, view: View): { x: number; y: number; z: number } {
	const l = (lon - view.lon) * RAD;
	const p = lat * RAD;
	const c = view.lat * RAD;
	const cx = Math.cos(p) * Math.cos(l);
	const cy = Math.cos(p) * Math.sin(l);
	const cz = Math.sin(p);
	return { x: cy, y: -cx * Math.sin(c) + cz * Math.cos(c), z: cx * Math.cos(c) + cz * Math.sin(c) };
}

/** Lo contrario: de un punto de la pantalla (radio 1, y hacia arriba) a latitud y longitud. Fuera del globo, null. */
export function invert(x: number, y: number, view: View): { lat: number; lon: number } | null {
	const d = x * x + y * y;
	if (d > 1) return null;
	const z = Math.sqrt(1 - d);
	const c = view.lat * RAD;
	const cx = z * Math.cos(c) - y * Math.sin(c);
	const cz = z * Math.sin(c) + y * Math.cos(c);
	return { lat: Math.asin(Math.max(-1, Math.min(1, cz))) / RAD, lon: wrapLon(Math.atan2(x, cx) / RAD + view.lon) };
}

/**
 * Puntos repartidos por igual sobre la esfera (espiral de Fibonacci) que caen en tierra según `isLand`.
 * Así la tierra se pinta como una trama de puntos, sin texturas.
 */
export function landDots(isLand: (lat: number, lon: number) => boolean, n = 14000): [number, number][] {
	const out: [number, number][] = [];
	const golden = Math.PI * (3 - Math.sqrt(5));
	for (let i = 0; i < n; i++) {
		const y = 1 - (2 * (i + 0.5)) / n;
		const lat = Math.asin(y) / RAD;
		const lon = wrapLon(((i * golden) / RAD) % 360);
		if (isLand(lat, lon)) out.push([lat, lon]);
	}
	return out;
}

/**
 * Las costas: el trazado «M x,y L x,y … Z» de world.ts (x = longitud + 180, y = 90 − latitud) en anillos de
 * [latitud, longitud].
 */
export function parseRings(d: string): [number, number][][] {
	const rings: [number, number][][] = [];
	for (const part of d.split('M').slice(1)) {
		const ring: [number, number][] = [];
		for (const xy of part.replace(/Z/g, '').split('L')) {
			const [x, y] = xy.split(',').map(Number);
			if (Number.isFinite(x) && Number.isFinite(y)) ring.push([90 - y, x - 180]);
		}
		if (ring.length > 1) rings.push(ring);
	}
	return rings;
}

/** Radio de un punto en px: `r` va en grados del mapa; nunca menos de 2,5 px para que se vea. */
export const pointPx = (r: number, radius: number) => Math.max(2.5, r * RAD * radius);

/**
 * El punto visible más cercano a (sx, sy), en px desde el centro del globo (y hacia abajo, como la pantalla),
 * dentro de su radio o de `touch` px (zona de toque mínima). Si no hay ninguno, null.
 */
export function pick<P extends GlobePoint>(
	points: P[],
	sx: number,
	sy: number,
	view: View,
	radius: number,
	touch = 14
): P | null {
	let best: P | null = null;
	let bestD = Infinity;
	for (const p of points) {
		const q = rotate(p.lat, p.lon, view);
		if (q.z <= 0) continue;
		const d = Math.hypot(q.x * radius - sx, -q.y * radius - sy);
		if (d <= Math.max(pointPx(p.r, radius), touch) && d < bestD) {
			best = p;
			bestD = d;
		}
	}
	return best;
}

/** El camino más corto de una longitud a otra (para girar hacia un punto sin dar la vuelta entera). */
export const lonDelta = (from: number, to: number) => wrapLon(to - from);
