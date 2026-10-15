// G: gráfico de cualquier serie que ya se descarga («G us10, bund»). Dos piezas:
// - CATÁLOGO: todas las series de static/data, generado al construir en /data/g/series.json (ver su +server.ts).
//   Las curvas de tipos (uscurve, eacurve, jgb) entran como una serie por plazo: «uscurve-10A».
// - ATAJOS: nombres cortos de las series más pedidas, para escribirlos en la barra y autocompletarlos.
// Lógica pura, sin Svelte, para probarla con Vitest.
import type { Point, Series } from './types.ts';

/** Una serie del catálogo: su id, de qué archivo sale (static/data/<ds>.json) y cómo se llama. */
export interface CatalogEntry {
	id: string;
	ds: string;
	label: string;
	unit: string;
	geo?: string;
	/** Desde cuándo hay datos y cuántos puntos (para avisar si es corta). */
	from: string;
	n: number;
}

/** Atajo: lo que se escribe en la barra («US10») y la serie a la que lleva. */
export interface Shortcut {
	code: string;
	id: string;
	name: string;
	keys?: string[];
}

export const SHORTCUTS: Shortcut[] = [
	{ code: 'US2', id: 'uscurve-2A', name: 'Bono de EE. UU. a 2 años' },
	{ code: 'US10', id: 'uscurve-10A', name: 'Bono de EE. UU. a 10 años', keys: ['treasury'] },
	{ code: 'US30', id: 'uscurve-30A', name: 'Bono de EE. UU. a 30 años' },
	{ code: 'EA10', id: 'eacurve-10A', name: 'Bono AAA de la zona euro a 10 años' },
	{ code: 'JP10', id: 'jgb-10A', name: 'Bono de Japón a 10 años', keys: ['jgb'] },
	{ code: 'BUND', id: 'bond10-de', name: 'Bono alemán a 10 años', keys: ['alemania'] },
	{ code: 'BONO', id: 'bond10-es', name: 'Bono español a 10 años', keys: ['españa'] },
	{ code: 'BTP', id: 'bond10-it', name: 'Bono italiano a 10 años', keys: ['italia'] },
	{ code: 'OAT', id: 'bond10-fr', name: 'Bono francés a 10 años', keys: ['francia'] },
	{ code: 'SOFR', id: 'nyfed-sofr', name: 'SOFR' },
	{ code: 'FED', id: 'fedfunds-us', name: 'Fondos federales', keys: ['effr'] },
	{ code: 'ESTR', id: 'estr', name: '€STR' },
	{ code: 'DEPO', id: 'ecb-dfr', name: 'Facilidad de depósito del BCE', keys: ['bce'] },
	{ code: 'EURIBOR', id: 'euribor-12m', name: 'Euríbor a 12 meses' },
	{ code: 'EURIBOR3', id: 'euribor-3m', name: 'Euríbor a 3 meses' },
	{ code: '2S10S', id: 't10y2y-us', name: 'Pendiente 10 años − 2 años (EE. UU.)' },
	{ code: 'VIX', id: 'vix', name: 'VIX' },
	{ code: 'WTI', id: 'wti', name: 'Petróleo WTI', keys: ['petróleo'] },
	{ code: 'DOLAR', id: 'dollar-broad', name: 'Dólar, índice amplio', keys: ['dxy'] },
	{ code: 'HY', id: 'hy-us', name: 'Alto rendimiento EE. UU.' },
	{ code: 'BE10', id: 'breakeven10-us', name: 'Inflación esperada a 10 años' },
	{ code: 'REAL10', id: 'real10-us', name: 'Tipo real a 10 años (TIPS)' },
	{ code: 'BALFED', id: 'fed-balance', name: 'Balance de la Fed' },
	{ code: 'CISS', id: 'ciss-ea', name: 'Estrés sistémico de la zona euro' },
	{ code: 'IPCUS', id: 'cpi-us', name: 'IPC de EE. UU.', keys: ['cpi'] },
	{ code: 'PAROUS', id: 'unemployment-us', name: 'Paro de EE. UU.' },
	{ code: 'IPC', id: 'ipc-es', name: 'IPC de España' },
	{ code: 'PARO', id: 'unemployment-es', name: 'Paro de España (Eurostat)' },
	{ code: 'HICP', id: 'inflation-ea', name: 'Inflación de la zona euro (IPCA)' }
];

/** Sin tildes y en mayúsculas, para comparar. */
const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').trim().toUpperCase();

/** Lo escrito tras «G»: separado por comas («us10, bund») o, si no hay comas, por espacios. */
export function parseTokens(raw: string): string[] {
	const parts = raw.includes(',') ? raw.split(',') : raw.split(/\s+/);
	return [...new Set(parts.map((p) => p.trim()).filter(Boolean))].slice(0, 6);
}

/**
 * La serie de un trozo: atajo («US10»), id exacto («sofr-us», «uscurve-10A») o, si no, la primera del catálogo
 * cuyo nombre lo contiene todo («euribor 12»). Null si no hay ninguna.
 */
export function resolve(token: string, catalog: CatalogEntry[]): CatalogEntry | null {
	const q = norm(token);
	if (!q) return null;
	const byId = (id: string) => catalog.find((c) => norm(c.id) === norm(id)) ?? null;
	const short = SHORTCUTS.find((s) => s.code === q || s.keys?.some((k) => norm(k) === q));
	if (short && byId(short.id)) return byId(short.id);
	const exact = byId(token);
	if (exact) return exact;
	const words = q.split(/\s+/);
	return catalog.find((c) => words.every((w) => norm(`${c.label} ${c.geo ?? ''} ${c.id}`).includes(w))) ?? null;
}

/** Búsqueda en el catálogo para la lista de la vista: todas las palabras en el nombre, el país o el id. */
export function searchCatalog(query: string, catalog: CatalogEntry[], limit = 40): CatalogEntry[] {
	const words = norm(query).split(/\s+/).filter(Boolean);
	if (!words.length) return [];
	return catalog.filter((c) => words.every((w) => norm(`${c.label} ${c.geo ?? ''} ${c.id} ${c.ds}`).includes(w))).slice(0, limit);
}

/** Saca del JSON de un archivo de static/data la serie pedida: por id, o un plazo de una curva («uscurve-10A»). */
export function extract(data: unknown, entry: CatalogEntry): Point[] {
	const d = data as { series?: Series[]; tenors?: string[]; days?: { date: string; values: (number | null)[] }[] };
	if (Array.isArray(d?.series)) return d.series.find((s) => s.id === entry.id)?.points ?? [];
	if (Array.isArray(d?.tenors) && Array.isArray(d?.days)) {
		const i = d.tenors.indexOf(entry.id.slice(entry.ds.length + 1));
		if (i < 0) return [];
		return d.days.flatMap((day) => (day.values[i] == null ? [] : [{ t: day.date, v: day.values[i] as number }]));
	}
	return [];
}

/** Catálogo de un archivo de static/data: sus series o, si es una curva, un plazo por serie. */
export function catalogOf(ds: string, data: unknown): CatalogEntry[] {
	const d = data as { series?: unknown; tenors?: unknown; days?: unknown };
	if (Array.isArray(d?.series)) {
		return (d.series as Partial<Series>[]).flatMap((s) =>
			typeof s?.id === 'string' && Array.isArray(s.points) && s.points.length > 1 && typeof s.points[0]?.v === 'number'
				? [{ id: s.id, ds, label: s.label ?? s.id, unit: s.unit ?? '', ...(s.geo ? { geo: s.geo } : {}), from: s.points[0].t, n: s.points.length }]
				: []
		);
	}
	if (Array.isArray(d?.tenors) && Array.isArray(d?.days) && d.days.length > 1) {
		const days = d.days as { date: string }[];
		return (d.tenors as string[]).map((tenor) => ({ id: `${ds}-${tenor}`, ds, label: `${CURVES[ds] ?? ds} · ${tenor.replace(/A$/, ' años').replace(/M$/, ' meses')}`, unit: '%', from: days[0].date, n: days.length }));
	}
	return [];
}

/** Nombre de cada curva de tipos en el catálogo. */
const CURVES: Record<string, string> = { uscurve: 'Bono de EE. UU.', eacurve: 'Bono AAA de la zona euro', jgb: 'Bono de Japón', vix: 'Curva del VIX' };

/** Pasa cada línea a base 100 en la primera fecha que tienen todas (para comparar series de unidades distintas). */
export function rebase(lines: Point[][]): Point[][] {
	if (!lines.length || lines.some((l) => !l.length)) return lines;
	const start = lines.map((l) => l[0].t).sort().at(-1)!;
	return lines.map((l) => {
		const base = l.find((p) => p.t >= start)?.v;
		if (!base) return [];
		return l.filter((p) => p.t >= start).map((p) => ({ t: p.t, v: (p.v / base) * 100 }));
	});
}
