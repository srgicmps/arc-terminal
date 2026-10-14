// Historial de estados de cada fuente para la vista STATUS: se va acumulando en status.json pasada a
// pasada (como el historial de precios de FUEL) y se queda solo con los últimos días.
import type { SourceStatus, StatePoint } from '../src/lib/data.ts';

/** Cuántos días de historial se guardan. */
export const HISTORY_DAYS = 7;

/** «2026-10-14T12:07:31.123Z» → «2026-10-14T12:07Z»: con el minuto basta y el archivo pesa menos. */
export function minute(ms: number): string {
	return new Date(ms).toISOString().slice(0, 16) + 'Z';
}

/**
 * Añade `point` al historial anterior y descarta lo que tenga más de `days` días (o una hora que no se
 * entienda). Devuelve una lista nueva, ordenada de la más antigua a la más reciente.
 */
export function appendHistory(
	previous: StatePoint[] | undefined,
	point: StatePoint,
	now: number,
	days = HISTORY_DAYS
): StatePoint[] {
	const since = now - days * 86_400_000;
	const kept = (Array.isArray(previous) ? previous : []).filter((p) => {
		const t = Date.parse(p?.t);
		return Number.isFinite(t) && t >= since && p.t !== point.t;
	});
	return [...kept, point].sort((a, b) => Date.parse(a.t) - Date.parse(b.t));
}

/**
 * A cada estado de esta pasada le pone su historial: el del status.json publicado (por nombre de
 * fuente) más el estado de ahora. Una fuente nueva empieza con un solo punto; una que ya no existe
 * desaparece con su historial.
 */
export function withHistory(
	statuses: SourceStatus[],
	previous: SourceStatus[] | null | undefined,
	now: number
): SourceStatus[] {
	const before = new Map((Array.isArray(previous) ? previous : []).map((s) => [s.name, s.history]));
	const t = minute(now);
	return statuses.map((s) => ({ ...s, history: appendHistory(before.get(s.name), { t, state: s.state }, now) }));
}
