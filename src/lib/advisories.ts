// Avisos de viaje del Departamento de Estado de EE. UU. (static/data/advisories.json, fuente advisories):
// nombres de los niveles, el país de cada aviso y los cambios recientes. Lo usan GEO y PAIS.
import { countryByName, type Country } from './countries.ts';
import type { TravelAdvisory } from './types.ts';

/** Lo que significa cada nivel, en español. */
export const LEVELS: Record<TravelAdvisory['level'], string> = {
	1: 'Precauciones normales',
	2: 'Más precaución',
	3: 'Reconsiderar el viaje',
	4: 'No viajar'
};

/** El país de un aviso, por su nombre en inglés («Ukraine» → UA). Solo los que conoce la terminal. */
export function advisoryCountry(a: Pick<TravelAdvisory, 'name'>): Country | undefined {
	return countryByName(a.name);
}

/** El aviso de un país (código ISO2), si lo hay. */
export function advisoryFor(items: TravelAdvisory[], code: string): TravelAdvisory | undefined {
	return items.find((a) => advisoryCountry(a)?.code === code);
}

/** Cuántos países hay en cada nivel: [nivel 1, nivel 2, nivel 3, nivel 4]. */
export function levelCounts(items: TravelAdvisory[]): [number, number, number, number] {
	const out: [number, number, number, number] = [0, 0, 0, 0];
	for (const a of items) out[a.level - 1]++;
	return out;
}

/**
 * Lo que ha cambiado en los últimos `days` días: primero los cambios de nivel (los apunta la fuente al
 * compararse con la copia anterior), del más reciente al más antiguo; después los avisos actualizados sin
 * cambio de nivel. Cada país una vez y como mucho `limit`.
 */
export function recentChanges(items: TravelAdvisory[], now: number, days = 30, limit = 15): TravelAdvisory[] {
	const since = now - days * 864e5;
	const recent = (iso: string | undefined) => !!iso && Date.parse(iso) >= since;
	const changed = items.filter((a) => recent(a.changedAt)).sort((a, b) => b.changedAt!.localeCompare(a.changedAt!));
	const updated = items.filter((a) => !recent(a.changedAt) && recent(a.updated)).sort((a, b) => b.updated.localeCompare(a.updated));
	return [...changed, ...updated].slice(0, limit);
}
