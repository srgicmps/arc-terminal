// ¿Están los datos de una fuente al día? Lo usa <Updated> para avisar cuando una fuente lleva tiempo
// sin actualizarse (por ejemplo, si su API falla y update.ts sigue usando la copia anterior).
// El maxAgeMinutes de cada fuente llega en static/data/status.json, que escribe scripts/update.ts.

/** Cada cuánto corre la Action que descarga los datos (cron de .github/workflows/deploy.yml). */
export const CRON_MINUTES = 15;

/**
 * Minutos a partir de los cuales los datos de una fuente se consideran viejos: el doble de lo que
 * tarda en refrescarse, que es lo mayor entre su maxAgeMinutes y el cron. Sin dato, null (no se avisa).
 */
export function staleAfter(maxAgeMinutes: number | null | undefined): number | null {
	if (!maxAgeMinutes || !Number.isFinite(maxAgeMinutes)) return null;
	return 2 * Math.max(maxAgeMinutes, CRON_MINUTES);
}

/** Minutos desde `iso` hasta `now`, o null si no hay fecha válida o el reloj aún no ha arrancado. */
export function ageMinutes(iso: string | null | undefined, now: number): number | null {
	if (!iso || !now) return null;
	const t = Date.parse(iso);
	return Number.isFinite(t) ? (now - t) / 60_000 : null;
}

/** «hace 45 min», «hace 6 h», «hace 2 d». */
export function ago(minutes: number): string {
	const m = Math.max(0, Math.floor(minutes));
	if (m < 60) return `hace ${m} min`;
	if (m < 24 * 60) return `hace ${Math.floor(m / 60)} h`;
	return `hace ${Math.floor(m / (24 * 60))} d`;
}
