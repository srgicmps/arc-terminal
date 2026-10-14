// Quién tiene la deuda de EE. UU.: tabla 5 del TIC del Tesoro («Major Foreign Holders of Treasury Securities»),
// en miles de millones de dólares, a fin de mes. scripts/sources/treasury.ts descarga el .txt. Pura, para probarla.

export interface TicHolder {
	/** Nombre en inglés, tal como lo da el Tesoro («Korea, South»). */
	id: string;
	name: string;
	/** Miles de millones de dólares, un valor por mes de `months`. */
	values: number[];
}

export interface TicData {
	/** Meses («2026-07») del más antiguo al más reciente. */
	months: string[];
	holders: TicHolder[];
	/** Todo el extranjero y la parte de bancos centrales y gobiernos («Foreign Official»). */
	total: number[];
	official: number[];
}

const NAMES: Record<string, string> = {
	Japan: 'Japón',
	'United Kingdom': 'Reino Unido',
	'China, Mainland': 'China',
	Belgium: 'Bélgica',
	'Cayman Islands': 'Islas Caimán',
	Luxembourg: 'Luxemburgo',
	Canada: 'Canadá',
	Ireland: 'Irlanda',
	France: 'Francia',
	Taiwan: 'Taiwán',
	Switzerland: 'Suiza',
	Singapore: 'Singapur',
	Norway: 'Noruega',
	Brazil: 'Brasil',
	'Saudi Arabia': 'Arabia Saudí',
	'Korea, South': 'Corea del Sur',
	'United Arab Emirates': 'Emiratos Árabes',
	Bermuda: 'Bermudas',
	Germany: 'Alemania',
	Israel: 'Israel',
	Mexico: 'México',
	Thailand: 'Tailandia',
	Philippines: 'Filipinas',
	Netherlands: 'Países Bajos',
	Bahamas: 'Bahamas',
	Kuwait: 'Kuwait',
	Australia: 'Australia',
	Spain: 'España'
};

/**
 * Lee el .txt: la cabecera «Country 2026-07 2026-06 …» da los meses (del más reciente al más antiguo) y cada fila
 * es un nombre (con espacios o comas) seguido de tantos números como meses. Se lee por los números del final.
 * «All Other» no se guarda; «Grand Total» y «Of Which: Foreign Official» van aparte.
 */
export function parseTic(text: string): TicData | null {
	const lines = text.split(/\r?\n/);
	const header = lines.find((l) => /^\s*Country\s+\d{4}-\d{2}/.test(l));
	if (!header) return null;
	const desc = header.match(/\d{4}-\d{2}/g) ?? [];
	const n = desc.length;
	const row = new RegExp(`^\\s*(\\S.*?)((?:\\s+-?[\\d.,]+){${n}})\\s*$`);
	const holders: TicHolder[] = [];
	let total: number[] = [];
	let official: number[] = [];
	for (const line of lines) {
		if (line === header) continue;
		const m = row.exec(line);
		if (!m) continue;
		const label = m[1].trim();
		const values = m[2].trim().split(/\s+/).map((v) => Number(v.replace(/,/g, ''))).reverse();
		if (values.some((v) => !Number.isFinite(v))) continue;
		if (/^grand total$/i.test(label)) total = values;
		else if (/^of which: foreign official$/i.test(label)) official = values;
		else if (/^of which|^all other/i.test(label)) continue;
		else holders.push({ id: label, name: NAMES[label] ?? label, values });
	}
	if (!holders.length || !total.length) return null;
	return { months: [...desc].reverse(), holders, total, official };
}
