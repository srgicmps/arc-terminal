// ACNUR: los países de los que más gente huye y los que más acogen (GEO) y la ficha de un país (PAIS).
// Lógica pura, con tests. Nombres en español para los países que conoce la terminal; si no, el de ACNUR.
import { COUNTRIES } from './countries.ts';
import type { UnhcrCountry, UnhcrData } from './types.ts';

const BY_ISO3 = new Map(COUNTRIES.map((c) => [c.iso3, c]));

/** Nombre en español si la terminal conoce el país; si no, el que da ACNUR. */
export const unhcrName = (c: Pick<UnhcrCountry, 'iso3' | 'name'>) => BY_ISO3.get(c.iso3)?.name ?? c.name;

/** Los `n` primeros por un campo, de más a menos, con el nombre ya en español. */
export function top(data: UnhcrData | null | undefined, key: 'from' | 'hosted' | 'idps', n = 10) {
	return [...(data?.countries ?? [])]
		.filter((c) => c[key] > 0)
		.sort((a, b) => b[key] - a[key])
		.slice(0, n)
		.map((c) => ({ iso3: c.iso3, name: unhcrName(c), value: c[key] }));
}

/** Las cifras de cada país que conoce la terminal, por su código ISO de dos letras («SY»). */
export function byCountry(data: UnhcrData | null | undefined): Record<string, Pick<UnhcrCountry, 'from' | 'hosted' | 'idps'>> {
	const out: Record<string, Pick<UnhcrCountry, 'from' | 'hosted' | 'idps'>> = {};
	for (const c of data?.countries ?? []) {
		const known = BY_ISO3.get(c.iso3);
		if (known) out[known.code] = { from: c.from, hosted: c.hosted, idps: c.idps };
	}
	return out;
}
