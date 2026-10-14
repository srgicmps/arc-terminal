// Paneles fijados en TOP: el registro de lo que se puede fijar y la lógica (funciones puras, con tests).
// El estado y el guardado en el navegador están en pins.svelte.ts.
// Los datos de un panel fijado se piden en el navegador (fetch de data/<nombre>.json) solo cuando está fijado:
// dataset() lee el disco al prerenderizar y en el navegador no sirve.
import type { Component } from 'svelte';
import type { Dataset } from './data.ts';
import type { Span } from './layout.ts';

/** Lo que recibe el contenido de un panel fijado: sus datasets por nombre (null si no se pudo leer). */
export interface PinProps {
	data: Record<string, Dataset<unknown> | null>;
}

export interface PinDef {
	/** «pin:<vista>:<panel>». Es la clave de lo guardado: no se cambia. */
	id: string;
	title: string;
	meta?: string;
	/** Vista de origen, para el enlace «CÓDIGO ›». */
	code: string;
	path: '/eco' | '/geo';
	/** Archivos de data/ que necesita (sin .json). Para los grandes, uno recortado en data/pin/. */
	datasets: string[];
	/** El contenido, cargado aparte: solo se descarga si el panel está fijado. */
	load: () => Promise<{ default: Component<PinProps> }>;
}

export const PINS: readonly PinDef[] = [
	{
		id: 'pin:eco:bancos',
		title: 'Bancos centrales',
		meta: 'Tipo oficial · último cambio',
		code: 'ECO',
		path: '/eco',
		datasets: ['bis'],
		load: () => import('./components/pins/EcoBancos.svelte')
	},
	{
		id: 'pin:geo:mapa',
		title: 'Mapa',
		meta: 'Toca un punto para ver su ficha',
		code: 'GEO',
		path: '/geo',
		// Recortado: solo los puntos de las capas (src/routes/data/pin/geo-mapa.json).
		datasets: ['pin/geo-mapa'],
		load: () => import('./components/pins/GeoMapa.svelte')
	}
];

export function findPin(id: string): PinDef | undefined {
	return PINS.find((p) => p.id === id);
}

export interface Pinned {
	id: string;
	span: Span;
}

/** Fija o suelta un panel. Los nuevos van al final. */
export function togglePin(list: readonly Pinned[], id: string): Pinned[] {
	return list.some((p) => p.id === id) ? list.filter((p) => p.id !== id) : [...list, { id, span: 1 }];
}

export function setPinSpan(list: readonly Pinned[], id: string, span: Span): Pinned[] {
	return list.map((p) => (p.id === id ? { ...p, span } : p));
}

/** Lo guardado, limpio: sin ids que ya no existen, sin repetidos y con anchos válidos. */
export function reconcilePins(saved: unknown, known: readonly string[] = PINS.map((p) => p.id)): Pinned[] {
	if (!Array.isArray(saved)) return [];
	const seen = new Set<string>();
	const out: Pinned[] = [];
	for (const item of saved) {
		const id = (item as Partial<Pinned>)?.id;
		if (typeof id !== 'string' || !known.includes(id) || seen.has(id)) continue;
		seen.add(id);
		const span = (item as Partial<Pinned>).span;
		out.push({ id, span: span === 2 || span === 3 ? span : 1 });
	}
	return out;
}
