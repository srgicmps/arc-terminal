// Catálogo de G: todas las series que hay en static/data (y las curvas de tipos, un plazo por serie), sin los
// puntos. Se genera al construir (prerender); la vista G lo descarga al abrirse y luego solo el archivo de
// cada serie que se pide, así que no pesa en el HTML de la vista.
import { json } from '@sveltejs/kit';
import { catalogOf, type CatalogEntry } from '#lib/gseries.ts';

export const prerender = true;

const files = import.meta.glob('/static/data/*.json', { import: 'default' });

export async function GET() {
	const seen = new Set<string>();
	const data: CatalogEntry[] = [];
	for (const [path, load] of Object.entries(files)) {
		const ds = path.slice('/static/data/'.length, -'.json'.length);
		const file = (await load()) as { data?: unknown };
		for (const entry of catalogOf(ds, file?.data)) {
			if (seen.has(entry.id)) continue;
			seen.add(entry.id);
			data.push(entry);
		}
	}
	return json({ name: 'g/series', fetchedAt: new Date().toISOString(), data });
}
