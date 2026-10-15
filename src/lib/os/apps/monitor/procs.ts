// Monitor del sistema de Arc OS: las fuentes de datos (status.json) vistas como «procesos». Lógica pura, con tests.
import type { SourceStatus } from '../../../data.ts';

export const STATE_TEXT: Record<SourceStatus['state'], string> = {
	ok: 'En marcha',
	cached: 'En reposo',
	stale: 'Con fallos',
	error: 'Caída',
	off: 'Sin clave'
};

/** Orden de gravedad: lo caído arriba. */
const RANK: Record<SourceStatus['state'], number> = { error: 0, stale: 1, off: 2, ok: 3, cached: 4 };

export type SortKey = 'state' | 'name' | 'age';

/** Minutos desde la última descarga (null si nunca). */
export const ageMin = (s: SourceStatus, now: number) => (s.fetchedAt ? Math.max(0, Math.round((now - Date.parse(s.fetchedAt)) / 60_000)) : null);

export function sortProcs(list: SourceStatus[], key: SortKey, now: number): SourceStatus[] {
	const byName = (a: SourceStatus, b: SourceStatus) => a.label.localeCompare(b.label, 'es');
	return [...list].sort((a, b) =>
		key === 'name' ? byName(a, b) : key === 'age' ? (ageMin(b, now) ?? 1e9) - (ageMin(a, now) ?? 1e9) || byName(a, b) : RANK[a.state] - RANK[b.state] || byName(a, b)
	);
}

/** Cuántas hay en cada estado y la «salud» en % (en marcha o en reposo frente a las que deberían funcionar). */
export function summary(list: SourceStatus[]) {
	const count = { ok: 0, cached: 0, stale: 0, error: 0, off: 0 } as Record<SourceStatus['state'], number>;
	for (const s of list) count[s.state]++;
	const active = list.length - count.off;
	return { count, total: list.length, health: active ? Math.round(((count.ok + count.cached) / active) * 100) : 100 };
}

/** «3 min», «2 h», «4 d». */
export function ageText(min: number | null): string {
	if (min === null) return '—';
	if (min < 60) return `${min} min`;
	if (min < 2880) return `${Math.round(min / 60)} h`;
	return `${Math.round(min / 1440)} d`;
}

/** ¿Va con retraso? Más del doble de lo que debería tardar en refrescarse. */
export const late = (s: SourceStatus, now: number) => {
	const age = ageMin(s, now);
	return age !== null && !!s.maxAgeMinutes && age > s.maxAgeMinutes * 2;
};
