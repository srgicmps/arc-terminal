// Stablecoins (scripts/sources/stablecoins.ts, DefiLlama): tipos compartidos por la fuente y la vista WS.

export interface Stablecoin {
	id: string;
	symbol: string;
	name: string;
	/** Cómo se respalda: «fiat-backed» (dinero y deuda pública), «crypto-backed» o «algorithmic». */
	mechanism: string;
	/** Dólares en circulación. */
	usd: number;
	/** Variación de lo que circula en 7 y en 30 días, en %. */
	week: number | null;
	month: number | null;
	/** Precio en dólares (debería ser ~1); null si DefiLlama no lo da. */
	price: number | null;
}

export interface StablecoinsData {
	/** Día del último total (AAAA-MM-DD, UTC) y total en dólares de todas las stablecoins. */
	date: string;
	total: number;
	/** Variación del total en 30 días y en un año, en %. */
	totalMonth: number | null;
	totalYear: number | null;
	/** Las más grandes ligadas al dólar, de mayor a menor. */
	coins: Stablecoin[];
}

/** Precio que se considera fuera de la paridad con el dólar: más de medio céntimo arriba o abajo. */
export const offPeg = (price: number | null) => price !== null && Math.abs(price - 1) >= 0.005;
