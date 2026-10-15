// Refugiados y desplazados según ACNUR (UNHCR Refugee Data Finder): API pública de población, sin clave.
// https://api.unhcr.org/docs/refugee-statistics.html · Dato anual (sale a mediados del año siguiente).
// Términos: datos abiertos de ACNUR, citando la fuente. Se pide una vez al día.
// Dos consultas por año: por país de origen (de dónde huyen) y por país de asilo (dónde están acogidos).
import type { UnhcrCountry, UnhcrData } from '../../src/lib/types.ts';
import { getJson, list, num, plain, type Source } from '../lib.ts';

type Raw = Record<string, any>;

const API = 'https://api.unhcr.org/population/v1/population/';

export const unhcrUrl = (year: number, by: 'coo' | 'coa') =>
	`${API}?${new URLSearchParams({ limit: '400', yearFrom: String(year), yearTo: String(year), [`${by}_all`]: 'true' })}`;

/** Suma de refugiados y solicitantes de asilo (lo que ACNUR llama «necesitan protección internacional»). */
const people = (r: Raw) => (num(r?.refugees) ?? 0) + (num(r?.asylum_seekers) ?? 0);

/** Por país: refugiados y solicitantes de asilo de origen, acogidos y desplazados internos. */
export function parseUnhcr(origin: Raw, asylum: Raw, year: number): UnhcrData {
	const byIso = new Map<string, UnhcrCountry>();
	const of = (iso: string, name: string) => {
		let c = byIso.get(iso);
		if (!c) byIso.set(iso, (c = { iso3: iso, name, from: 0, hosted: 0, idps: 0 }));
		return c;
	};
	for (const r of list<Raw>(origin?.items)) {
		const iso = String(r?.coo_iso ?? '');
		if (!/^[A-Z]{3}$/.test(iso)) continue;
		const c = of(iso, plain(r?.coo_name, 80));
		c.from += people(r);
		c.idps += num(r?.idps) ?? 0;
	}
	for (const r of list<Raw>(asylum?.items)) {
		const iso = String(r?.coa_iso ?? '');
		if (!/^[A-Z]{3}$/.test(iso)) continue;
		of(iso, plain(r?.coa_name, 80)).hosted += people(r);
	}
	return { year, countries: [...byIso.values()].filter((c) => c.from || c.hosted || c.idps) };
}

export const unhcr: Source<UnhcrData> = {
	name: 'unhcr',
	label: 'Refugiados y desplazados por país · ACNUR (Refugee Data Finder)',
	maxAgeMinutes: 24 * 60,
	async fetch() {
		// El último año con datos: el anterior al actual o, si aún no ha salido, el de antes.
		const now = new Date().getUTCFullYear();
		for (const year of [now - 1, now - 2]) {
			const [origin, asylum] = await Promise.all([getJson<Raw>(unhcrUrl(year, 'coo')), getJson<Raw>(unhcrUrl(year, 'coa'))]);
			const data = parseUnhcr(origin, asylum, year);
			if (data.countries.length >= 20) return data;
		}
		throw new Error('ACNUR no da datos de los dos últimos años');
	}
};
