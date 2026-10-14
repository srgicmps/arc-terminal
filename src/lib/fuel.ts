// Forma de data/fuel.json. La comparten el script que descarga los datos (scripts/fuel.ts) y la vista FUEL.

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

export interface FuelData {
	/** Fecha de los datos según el Ministerio, tal cual la publica: «14/10/2026 12:30:05». */
	sourceDate: string;
	/** Cuándo los descargamos nosotros (ISO 8601). */
	fetchedAt: string;
	stations: FuelStation[];
}
