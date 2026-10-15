// Paro registrado del SEPE por comunidad autónoma (datos abiertos, mensual). Sin imports de Vite: lo usa también
// el script de Node.
import type { Point } from './types.ts';

export interface ParoRegion {
	/** Código de comunidad del INE: 1 Andalucía … 19 Melilla. */
	code: number;
	name: string;
	/** Parados registrados el último mes. */
	value: number;
	/** Variación en % frente al mes anterior y frente al mismo mes del año pasado; null si no hay dato. */
	mom: number | null;
	yoy: number | null;
}

export interface ParoData {
	/** Último mes: «2026-09». */
	month: string;
	/** Total de España, mes a mes (personas). */
	national: Point[];
	/** Comunidades, de más a menos parados. */
	regions: ParoRegion[];
}
