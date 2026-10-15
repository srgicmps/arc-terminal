// F21: avisos a navegantes de zonas calientes, de la NGA de EE. UU. (Maritime Safety Information,
// https://msi.nga.mil, dominio público, sin clave). Dos peticiones cada 2 h: HYDROPAC (Índico, Golfo, Pacífico)
// y HYDROLANT (Atlántico, Mediterráneo, mar Negro). Sondeado en el PR #415. El filtro, en src/lib/navwarn.ts.
import { toWarning, type NavWarnData, type NavWarning, type RawWarning } from '../../src/lib/navwarn.ts';
import { getJson, type Source } from '../lib.ts';

const API = 'https://msi.nga.mil/api/publications/broadcast-warn?output=json&status=active&navArea=';
const KEEP = 40;

export function pickWarnings(raw: RawWarning[]): NavWarning[] {
	return raw
		.map(toWarning)
		.filter((w): w is NavWarning => !!w)
		.sort((a, b) => (b.issued ?? '').localeCompare(a.issued ?? ''))
		.slice(0, KEEP);
}

export const navwarn: Source<NavWarnData> = {
	name: 'navwarn',
	label: 'Avisos a navegantes en zonas calientes · NGA (HYDROPAC y HYDROLANT)',
	maxAgeMinutes: 120,
	async fetch() {
		const lists = await Promise.all(['P', 'A'].map((a) => getJson<{ 'broadcast-warn'?: RawWarning[] }>(API + a)));
		const raw = lists.flatMap((l) => l['broadcast-warn'] ?? []);
		if (!raw.length) throw new Error('La NGA no ha devuelto avisos');
		return { items: pickWarnings(raw) };
	}
};
