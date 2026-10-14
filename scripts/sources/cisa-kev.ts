// Catálogo KEV de la CISA (agencia de ciberseguridad de EE. UU.): vulnerabilidades que ya se están
// explotando de verdad. JSON público y sin clave: https://www.cisa.gov/known-exploited-vulnerabilities-catalog
// Es de dominio público (obra del Gobierno de EE. UU.). La CISA lo actualiza varias veces por semana;
// el campo dateAdded es solo el día (AAAA-MM-DD).
import type { KevData, KevItem } from '../../src/lib/types.ts';
import { getJson, list, type Source } from '../lib.ts';

const URL = 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json';
/** Cuántas se guardan. */
const MAX = 10;

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const isDay = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

/** Convierte el JSON del catálogo en las más recientes y cuántas se han añadido `day` (AAAA-MM-DD). */
export function parseKev(body: any, day: string): KevData {
	const all: KevItem[] = [];
	for (const v of list<any>(body?.vulnerabilities)) {
		const cveID = text(v?.cveID);
		const dateAdded = text(v?.dateAdded).slice(0, 10);
		if (!/^CVE-\d{4}-\d+$/i.test(cveID) || !isDay(dateAdded)) continue;
		all.push({
			cveID: cveID.toUpperCase(),
			vendorProject: text(v.vendorProject),
			product: text(v.product),
			vulnerabilityName: text(v.vulnerabilityName),
			dateAdded,
			ransomware: text(v.knownRansomwareCampaignUse).toLowerCase() === 'known'
		});
	}
	// El catálogo viene más o menos en orden de alta, pero no está garantizado: se ordena por fecha
	// (las fechas AAAA-MM-DD se ordenan bien como texto) y, el mismo día, por número de CVE.
	all.sort((a, b) => b.dateAdded.localeCompare(a.dateAdded) || b.cveID.localeCompare(a.cveID, 'en', { numeric: true }));
	return {
		items: all.slice(0, MAX),
		total: all.length,
		day,
		today: all.filter((v) => v.dateAdded === day).length
	};
}

export const cisaKev: Source<KevData> = {
	name: 'cisa-kev',
	label: 'CISA · vulnerabilidades explotadas (KEV)',
	maxAgeMinutes: 360,
	async fetch() {
		// «Hoy» se cuenta en UTC, el día que usa la CISA en dateAdded.
		const day = new Date().toISOString().slice(0, 10);
		const data = parseKev(await getJson(URL), day);
		if (!data.items.length) throw new Error('catálogo sin vulnerabilidades');
		return data;
	}
};
