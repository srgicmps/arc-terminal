// Proyecciones de la Fed (ECO, panel provisional): la tabla del «dot plot» de la SEP (Summary of Economic
// Projections) con las series anuales de FRED. Cada serie tiene un punto por año proyectado («2026», «2027»…).
//
// Para quitar el panel: este archivo, su test, FedProjections.svelte, su línea en eco/+page.svelte y en
// eco/+page.server.ts, la entrada del manual (commands/eco.ts) y las series «sep-*» de scripts/sources/fred.ts.
import type { Series } from './types.ts';

export interface SepCell {
	/** Mediana de los participantes del FOMC. */
	md: number;
	/** Rango: la proyección más baja y la más alta (null si falta la serie). */
	lo: number | null;
	hi: number | null;
}

export interface SepRow {
	name: string;
	unit: string;
	decimals: number;
	cells: Record<string, SepCell>;
	/** Enlace a la serie de la mediana en FRED. */
	url?: string;
}

export interface SepTable {
	/** Años con alguna mediana, ordenados. */
	years: string[];
	rows: SepRow[];
	/** Mediana del tipo a largo plazo, si existe. */
	longRun?: number;
}

/** Filas de la tabla: prefijo de los ids («sep-rate» → sep-rate-md, -lo, -hi), nombre y decimales. */
export const SEP_ROWS = [
	{ key: 'sep-rate', name: 'Tipo de los fondos federales', decimals: 2 },
	{ key: 'sep-pce', name: 'Inflación PCE', decimals: 1 },
	{ key: 'sep-unrate', name: 'Paro', decimals: 1 }
];

/** Todas las series que usa el panel (para recortar en +page.server.ts). */
export const SEP_IDS = [...SEP_ROWS.flatMap((r) => ['md', 'lo', 'hi'].map((k) => `${r.key}-${k}`)), 'sep-rate-lr'];

/**
 * Construye la tabla. Solo salen los años que tienen mediana y, si se indica, desde `fromYear` (los años ya
 * pasados guardan la última proyección que se hizo, que ya no es una previsión). Una fila sin ninguna mediana
 * se quita; una celda sin rango se queda con la mediana sola. Sin medianas, no hay tabla (null).
 */
export function sepTable(series: Series[], fromYear?: number): SepTable | null {
	const get = (id: string) => series.find((s) => s.id === id);
	const value = (s: Series | undefined, t: string) => s?.points.find((p) => p.t === t)?.v ?? null;
	const keep = (t: string) => /^\d{4}$/.test(t) && (fromYear === undefined || Number(t) >= fromYear);

	const rows: SepRow[] = SEP_ROWS.flatMap((r) => {
		const md = get(`${r.key}-md`);
		const lo = get(`${r.key}-lo`);
		const hi = get(`${r.key}-hi`);
		const cells: Record<string, SepCell> = {};
		for (const p of md?.points ?? []) if (keep(p.t)) cells[p.t] = { md: p.v, lo: value(lo, p.t), hi: value(hi, p.t) };
		return Object.keys(cells).length ? [{ name: r.name, unit: md!.unit, decimals: r.decimals, cells, url: md!.url }] : [];
	});
	if (!rows.length) return null;
	const years = [...new Set(rows.flatMap((r) => Object.keys(r.cells)))].sort();
	const longRun = get('sep-rate-lr')?.points.at(-1)?.v;
	return longRun === undefined ? { years, rows } : { years, rows, longRun };
}
