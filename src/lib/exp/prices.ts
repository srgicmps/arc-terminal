// Precio de ahora de lo que se anota en la Bitácora: un valor con cotización de Finnhub
// (static/data/alert-quotes.json, unos 45 de EE. UU.) o una serie de G por su atajo o su id («US10», «BTC»,
// «sofr-us»). Se piden en el navegador, una vez por visita. Null si no hay precio para eso.
import { asset } from '$app/paths';
import { loadCatalog, loadPoints } from '#lib/gfetch.ts';
import { resolve, SHORTCUTS } from '#lib/gseries.ts';
import type { Quote } from '#lib/types.ts';

let quotes: Promise<Quote[]> | null = null;

function loadQuotes(): Promise<Quote[]> {
	quotes ??= fetch(asset('data/alert-quotes.json' as Parameters<typeof asset>[0]))
		.then((r) => (r.ok ? r.json() : null))
		.then((d: { data?: Quote[] } | null) => d?.data ?? [])
		.catch(() => []);
	return quotes;
}

export interface Price {
	value: number;
	/** De dónde sale, para enseñarlo: «NVDA · Finnhub» o el nombre de la serie. */
	label: string;
	unit: string;
}

export async function priceOf(about: string): Promise<Price | null> {
	const code = about.trim().toUpperCase();
	if (!code) return null;
	const q = (await loadQuotes()).find((x) => x.symbol === code);
	if (q && Number.isFinite(q.price)) return { value: q.price, label: `${code} · Finnhub`, unit: '$' };
	try {
		// Solo atajos («US10») o ids exactos: la búsqueda por palabras de G daría cualquier serie para «ES».
		const catalog = await loadCatalog();
		const known = SHORTCUTS.some((s) => s.code === code) || catalog.some((c) => c.id.toUpperCase() === code);
		const entry = known ? resolve(about, catalog) : null;
		if (!entry) return null;
		const points = await loadPoints(entry);
		const last = points.at(-1);
		return last ? { value: last.v, label: entry.label, unit: entry.unit } : null;
	} catch {
		return null;
	}
}
