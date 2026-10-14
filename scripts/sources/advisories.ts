// Avisos de viaje del Departamento de Estado de EE. UU.: nivel 1 a 4 por país, sin clave.
// https://cadataapi.state.gov/api/TravelAdvisories → [{ Title: «Ukraine - Level 4: Do Not Travel», Link,
// Category: ['UP'] (códigos FIPS, no ISO), Summary (HTML), Published, Updated }]. Dominio público (gobierno
// federal de EE. UU.). El título da el país y el nivel; el código FIPS no se usa porque no es ISO.
// La API no dice si el nivel ha cambiado: se compara con la copia anterior y se apunta el cambio.
import type { AdvisoriesData, TravelAdvisory } from '../../src/lib/types.ts';
import { getJson, list, type Source } from '../lib.ts';

const API = 'https://cadataapi.state.gov/api/TravelAdvisories';

/** Cuánto se recuerda un cambio de nivel visto por la terminal. */
const KEEP_CHANGE_DAYS = 30;

/** «Ukraine - Level 4: Do Not Travel» → { name: «Ukraine», level: 4 }; null si no encaja. */
export function parseTitle(title: string): { name: string; level: TravelAdvisory['level'] } | null {
	const m = /^\s*(.+?)\s+[-–]\s+Level\s+([1-4])\b/i.exec(title);
	return m ? { name: m[1].trim(), level: Number(m[2]) as TravelAdvisory['level'] } : null;
}

/** Fecha ISO válida o null. */
function isoOrNull(value: unknown): string | null {
	const t = Date.parse(String(value ?? ''));
	return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

export const advisories: Source<AdvisoriesData> = {
	name: 'advisories',
	label: 'Avisos de viaje · Departamento de Estado de EE. UU.',
	// Cambian pocas veces por semana: cada 3 horas sobra.
	maxAgeMinutes: 175,
	minItems: 100,
	async fetch(previous) {
		const raw = list(await getJson<Record<string, unknown>[]>(API));
		const before = new Map((previous?.items ?? []).map((i) => [i.name, i]));
		const now = Date.now();
		const items = raw.flatMap((r): TravelAdvisory[] => {
			const title = String(r.Title ?? '');
			const parsed = parseTitle(title);
			const updated = isoOrNull(r.Updated) ?? isoOrNull(r.Published);
			if (!parsed || !updated) return [];
			const item: TravelAdvisory = { ...parsed, title, url: String(r.Link ?? ''), updated };
			const old = before.get(parsed.name);
			if (old && old.level !== parsed.level) {
				item.prevLevel = old.level;
				item.changedAt = new Date(now).toISOString();
			} else if (old?.changedAt && now - Date.parse(old.changedAt) < KEEP_CHANGE_DAYS * 864e5) {
				// Un cambio reciente se sigue enseñando hasta 30 días.
				item.prevLevel = old.prevLevel;
				item.changedAt = old.changedAt;
			}
			return [item];
		});
		if (!items.length) throw new Error('el Departamento de Estado no devuelve avisos');
		items.sort((a, b) => b.level - a.level || a.name.localeCompare(b.name));
		return { items };
	}
};
