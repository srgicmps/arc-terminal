// Modelos frontera de IA y su cómputo de entrenamiento, de Epoch AI («Data on AI models», CC BY 4.0).
// Sin imports de Vite: lo usa también el script de Node.

export interface FrontierModel {
	name: string;
	org: string;
	/** Día de publicación: «2026-09-03». */
	date: string;
	/** Cómputo de entrenamiento estimado, en FLOP; null si Epoch aún no lo ha estimado. */
	flop: number | null;
	country: string;
	url: string;
}

export interface FrontierData {
	/** Los más recientes primero. */
	models: FrontierModel[];
	/** El de más cómputo de toda la lista (el récord). */
	record: FrontierModel | null;
}

const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';

/** 9.4e26 → «9,4·10²⁶». */
export function flops(n: number | null): string {
	if (n === null || !Number.isFinite(n) || n <= 0) return '—';
	const exp = Math.floor(Math.log10(n));
	const mant = (n / 10 ** exp).toFixed(1).replace('.', ',');
	return `${mant}·10${[...String(exp)].map((d) => SUP[Number(d)]).join('')}`;
}

/** Largo de la barra en escala logarítmica, desde 10²³ FLOP hasta el récord. */
export function flopPct(n: number | null, max: number | null): number {
	if (!n || !max || max <= 1e23) return 0;
	const pct = ((Math.log10(n) - 23) / (Math.log10(max) - 23)) * 100;
	return Math.max(0, Math.min(100, pct));
}
