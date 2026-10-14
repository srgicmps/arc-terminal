// Forma de static/data/fuel.json. La comparten el script que descarga los datos
// (scripts/sources/fuel.ts) y la vista FUEL.

export type FuelKey = 'g95' | 'diesel';

export const FUELS: { key: FuelKey; label: string }[] = [
	{ key: 'g95', label: 'Gasolina 95' },
	{ key: 'diesel', label: 'Diésel' }
];

export interface FuelStation {
	id: string;
	name: string;
	address: string;
	town: string;
	schedule: string;
	lat: number;
	lon: number;
	/** €/L, o null si la estación no vende ese combustible. */
	prices: Record<FuelKey, number | null>;
}

/** Un día del historial: precio medio y mínimo de Menorca. */
export interface FuelDay {
	date: string;
	avg: Record<FuelKey, number | null>;
	min: Record<FuelKey, number | null>;
}

export interface FuelData {
	/** Fecha de los datos según el Ministerio, tal cual la publica: «14/10/2026 12:30:05». */
	sourceDate: string;
	stations: FuelStation[];
	/** Historial diario que va acumulando la propia web (la API solo da el precio de hoy). */
	history?: FuelDay[];
}

/** Distancia en línea recta, en km, entre dos puntos (fórmula de Haversine). */
export function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
	const rad = (deg: number) => (deg * Math.PI) / 180;
	const dLat = rad(b.lat - a.lat);
	const dLon = rad(b.lon - a.lon);
	const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
	return 2 * 6371 * Math.asin(Math.sqrt(h));
}
