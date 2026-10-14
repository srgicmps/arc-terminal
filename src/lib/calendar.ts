// Carga el calendario de próximos datos (releases-cal.json) una sola vez para todas las tablas de la
// página. Va aparte de nextrelease.ts porque usa dataset() (import.meta.glob de Vite), que Node no entiende.
import { dataset } from './data.ts';
import type { ReleaseCalData, ReleaseEvent } from './types.ts';

let cache: Promise<ReleaseEvent[]> | null = null;

/** Eventos del calendario, o una lista vacía si aún no hay datos. */
export function loadCalendar(): Promise<ReleaseEvent[]> {
	cache ??= dataset<ReleaseCalData>('releases-cal').then(
		(d) => d?.data.events ?? [],
		() => []
	);
	return cache;
}
