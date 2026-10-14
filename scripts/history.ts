// Historial de estados de cada fuente para la vista STATUS (static/data/status-history.json). Se va
// acumulando pasada a pasada a partir de la copia publicada, como el historial de precios de FUEL.
// Se guarda por tramos: una entrada nueva solo cuando cambia el estado, con un contador de pasadas.
import type { SourceHistory, SourceStatus, StateSpan } from '../src/lib/data.ts';

/** Cuántos días de historial se guardan. */
export const HISTORY_DAYS = 7;

/** «2026-10-14T12:07:31.123Z» → «2026-10-14T12:07Z»: con el minuto basta. */
export function minute(ms: number): string {
	return new Date(ms).toISOString().slice(0, 16) + 'Z';
}

/**
 * Suma una pasada con estado `state` a los tramos anteriores: si es el mismo estado que el último
 * tramo, le suma una pasada; si cambia, abre un tramo nuevo. Luego descarta los tramos que acabaron
 * hace más de `days` días (el último se queda siempre). Devuelve una lista nueva.
 */
export function appendSpan(
	previous: StateSpan[] | undefined,
	state: SourceStatus['state'],
	now: number,
	days = HISTORY_DAYS
): StateSpan[] {
	const spans = (Array.isArray(previous) ? previous : []).filter(
		(s) => s && Number.isFinite(Date.parse(s.t)) && Number(s.runs) > 0
	);
	const last = spans.at(-1);
	const next =
		last && last.state === state
			? [...spans.slice(0, -1), { ...last, runs: last.runs + 1 }]
			: [...spans, { t: minute(now), state, runs: 1 }];
	// Un tramo acaba cuando empieza el siguiente: si eso fue antes del límite, ya no hace falta.
	const since = now - days * 86_400_000;
	return next.filter((_, i) => i === next.length - 1 || Date.parse(next[i + 1].t) >= since);
}

/**
 * El historial de cada fuente de esta pasada: el publicado (por nombre) más el estado de ahora.
 * Una fuente nueva empieza con un tramo; una que ya no existe desaparece con su historial.
 */
export function withHistory(
	statuses: SourceStatus[],
	previous: SourceHistory[] | null | undefined,
	now: number
): SourceHistory[] {
	const before = new Map((Array.isArray(previous) ? previous : []).map((h) => [h?.name, h?.history]));
	return statuses.map((s) => ({
		name: s.name,
		lastRun: minute(now),
		history: appendSpan(before.get(s.name), s.state, now)
	}));
}
