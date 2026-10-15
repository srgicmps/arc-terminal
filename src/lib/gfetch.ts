// Descarga en el navegador del catálogo de series (/data/g/series.json) y de los archivos de static/data que
// piden G y SEAS. Cada archivo se pide una sola vez por visita.
import { asset } from '$app/paths';
import { extract, type CatalogEntry } from './gseries.ts';
import type { Point } from './types.ts';

const files = new Map<string, Promise<unknown>>();

function file(name: string): Promise<unknown> {
	if (!files.has(name)) {
		const url = asset(`data/${name}.json` as Parameters<typeof asset>[0]);
		files.set(name, fetch(url).then((r) => (r.ok ? r.json() : null)));
	}
	return files.get(name)!;
}

export async function loadCatalog(): Promise<CatalogEntry[]> {
	return ((await file('g/series')) as { data?: CatalogEntry[] } | null)?.data ?? [];
}

export async function loadPoints(entry: CatalogEntry): Promise<Point[]> {
	return extract(((await file(entry.ds)) as { data?: unknown } | null)?.data, entry);
}
