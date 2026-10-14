// Carga el calendario de próximos datos (data/releases-cal.json) una sola vez para todas las tablas de la
// página. Se pide en el navegador, como los JSON de FUEL: es pequeño (solo los datos que enseña la terminal)
// y así SeriesTable no obliga a tocar el +page.server.ts de cada vista. Sin red o sin archivo, lista vacía.
import { asset } from '$app/paths';
import type { Dataset } from './data.ts';
import type { ReleaseCalData, ReleaseEvent } from './types.ts';

let cache: Promise<ReleaseEvent[]> | null = null;

export function loadCalendar(): Promise<ReleaseEvent[]> {
	cache ??= fetch(asset('data/releases-cal.json' as Parameters<typeof asset>[0]))
		.then((r) => (r.ok ? (r.json() as Promise<Dataset<ReleaseCalData>>) : null))
		.then((d) => d?.data.events ?? [])
		.catch(() => []);
	return cache;
}
