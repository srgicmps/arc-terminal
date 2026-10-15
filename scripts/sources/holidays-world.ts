// Festivos de unos 40 países (los más probables para Tu sitio), de este año y del siguiente, con las regiones a las
// que afecta cada uno (counties, códigos ISO 3166-2 como ES-MD). Para PUENTES (F6): próximos festivos y puentes de
// España (con tu comunidad) y de tu país. Nager.Date, API abierta sin clave (licencia MIT del proyecto), la misma
// que `holidays`. Si un país falla, se queda el de la copia anterior.
import type { WorldHoliday, WorldHolidaysData } from '../../src/lib/puentes.ts';
import { getJson, list, type Source } from '../lib.ts';

type Raw = Record<string, any>;

/** Códigos ISO de los países con festivos (Nager.Date los tiene todos). */
export const HOLIDAY_COUNTRIES = [
	'ES', 'PT', 'FR', 'IT', 'DE', 'AT', 'CH', 'BE', 'NL', 'LU', 'IE', 'GB', 'DK', 'SE', 'NO', 'FI', 'PL', 'CZ', 'GR', 'RO',
	'HU', 'HR', 'US', 'CA', 'MX', 'AR', 'BR', 'CL', 'CO', 'PE', 'UY', 'VE', 'EC', 'MA', 'ZA', 'JP', 'CN', 'KR', 'AU', 'NZ'
];

/** Países de habla hispana: el nombre local del festivo; en los demás, el inglés (más fácil de leer que 文化の日). */
const SPANISH = new Set(['ES', 'MX', 'AR', 'CL', 'CO', 'PE', 'UY', 'VE', 'EC']);

export function parseHolidays(raw: Raw[], cc = 'ES'): WorldHoliday[] {
	return list<Raw>(raw).flatMap((h) => {
		if (!h?.date) return [];
		const counties = h.global ? [] : list<string>(h.counties);
		const types = list<string>(h.types);
		// Solo los días de fiesta de verdad: fuera los de bancos u opcionales (Nager los marca con «types»).
		if (types.length && !types.includes('Public')) return [];
		const name = SPANISH.has(cc) ? (h.localName ?? h.name) : (h.name ?? h.localName);
		return [{ date: String(h.date), name: String(name), ...(counties.length ? { counties } : {}) }];
	});
}

export const holidaysWorld: Source<WorldHolidaysData> = {
	name: 'holidays-world',
	label: 'Festivos de 40 países y sus regiones · Nager.Date',
	maxAgeMinutes: 1435,
	async fetch(previous) {
		const year = new Date().getUTCFullYear();
		const countries: Record<string, WorldHoliday[]> = {};
		// De 8 en 8, para no saturar la API.
		for (let i = 0; i < HOLIDAY_COUNTRIES.length; i += 8) {
			const batch = HOLIDAY_COUNTRIES.slice(i, i + 8);
			const got = await Promise.allSettled(
				batch.map(async (cc) => {
					const years = await Promise.all(
						[year, year + 1].map((y) => getJson<Raw[]>(`https://date.nager.at/api/v3/PublicHolidays/${y}/${cc}`))
					);
					return years.flatMap((y) => parseHolidays(y, cc));
				})
			);
			got.forEach((r, j) => {
				const cc = batch[j];
				const items = r.status === 'fulfilled' && r.value.length ? r.value : previous?.countries[cc];
				if (items?.length) countries[cc] = [...items].sort((a, b) => a.date.localeCompare(b.date));
			});
		}
		if (!countries.ES) throw new Error('Nager.Date no devuelve festivos de España');
		return { countries };
	}
};
