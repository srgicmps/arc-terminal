// Forma de los datos de gasolineras. La comparten los scripts (scripts/sources/fuel.ts) y la vista FUEL.
//  - static/data/fuel.json: Menorca, con historial diario.
//  - static/data/fuel-es.json: índice de provincias con precios medios.
//  - static/data/fuel/<id de provincia>.json: gasolineras de cada provincia (se cargan al elegirla).

export type FuelKey = 'g95' | 'diesel' | 'g98' | 'glp';

export const FUELS: { key: FuelKey; label: string }[] = [
	{ key: 'g95', label: 'Gasolina 95' },
	{ key: 'diesel', label: 'Diésel' },
	{ key: 'g98', label: 'Gasolina 98' },
	{ key: 'glp', label: 'GLP' }
];

/** Campos de la API del Ministerio para cada combustible. */
export const FUEL_FIELDS: Record<FuelKey, string> = {
	g95: 'Precio Gasolina 95 E5',
	diesel: 'Precio Gasoleo A',
	g98: 'Precio Gasolina 98 E5',
	glp: 'Precio Gases licuados del petróleo'
};

export type FuelPrices = Record<FuelKey, number | null>;

export interface FuelStation {
	id: string;
	name: string;
	address: string;
	town: string;
	schedule: string;
	lat: number;
	lon: number;
	/** €/L, o null si la estación no vende ese combustible. */
	prices: FuelPrices;
}

/** Un día del historial: precio medio y mínimo de Menorca. */
export interface FuelDay {
	date: string;
	avg: FuelPrices;
	min: FuelPrices;
}

export interface FuelData {
	/** Fecha de los datos según el Ministerio, tal cual la publica: «14/10/2026 12:30:05». */
	sourceDate: string;
	stations: FuelStation[];
	/** Historial diario que va acumulando la propia web (la API solo da el precio de hoy). */
	history?: FuelDay[];
}

export interface FuelProvince {
	id: string;
	name: string;
	count: number;
	/** Centro aproximado (media de sus gasolineras), para «cerca de mí». */
	lat: number;
	lon: number;
	avg: FuelPrices;
	min: FuelPrices;
}

export interface FuelSpainData {
	sourceDate: string;
	provinces: FuelProvince[];
	/** Media de toda España. */
	avg: FuelPrices;
}

/** Distancia en km entre dos puntos (fórmula del haversine). */
export function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
	const rad = Math.PI / 180;
	const dLat = (b.lat - a.lat) * rad;
	const dLon = (b.lon - a.lon) * rad;
	const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
	return 2 * 6371 * Math.asin(Math.sqrt(h));
}
