// Festivos de España y de Baleares, de este año y del siguiente. Nager.Date: API abierta, sin clave.
// https://date.nager.at/Api · Datos públicos (licencia MIT del proyecto).
import type { Holiday, HolidaysData } from '../../src/lib/types.ts';
import { getJson, list, type Source } from '../lib.ts';

type Raw = Record<string, any>;

export const holidays: Source<HolidaysData> = {
	name: 'holidays',
	label: 'Festivos de España y Baleares · Nager.Date',
	// Cambian una vez al año: con mirar cada día sobra.
	maxAgeMinutes: 1435,
	async fetch() {
		const year = new Date().getUTCFullYear();
		const years = await Promise.all(
			[year, year + 1].map((y) => getJson<Raw[]>(`https://date.nager.at/api/v3/PublicHolidays/${y}/ES`))
		);
		const items: Holiday[] = years.flat().flatMap((h) => {
			const counties = list<string>(h.counties);
			// Los nacionales (global) y los propios de Baleares (ES-IB). Los de otras comunidades, fuera.
			const scope = h.global ? 'ES' : counties.includes('ES-IB') ? 'IB' : null;
			return scope && h.date ? [{ date: String(h.date), name: String(h.localName ?? h.name), scope }] : [];
		});
		if (!items.length) throw new Error('Nager.Date no devuelve festivos');
		return { items: items.sort((a, b) => a.date.localeCompare(b.date)) };
	}
};
