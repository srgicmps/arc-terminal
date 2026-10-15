// F21: avisos a navegantes de zonas calientes (Mar Rojo, Ormuz, Golfo, mar Negro, Mediterráneo oriental…).
// UKMTO y MARAD dan 403 desde Actions; en su lugar, los avisos de radio HYDROPAC y HYDROLANT de la NGA de
// EE. UU. (Maritime Safety Information, dominio público), que recogen los de NAVAREA IX, JRCC y otros. Muchos
// son rutinarios (pecios, cables, prospecciones): aquí solo se quedan los de zonas calientes y de seguridad
// (maniobras, minas, misiles, ataques, interferencias GPS…). Funciones puras; la descarga, en scripts/sources/navwarn.ts.
import { findCountries } from './countries.ts';


export interface NavWarning {
	/** «HYDROPAC 1540/24». */
	id: string;
	/** Zona en español: «Golfo Pérsico». */
	region: string;
	/** Segunda línea del aviso (país o subzona), tal cual: «QATAR». */
	place: string;
	/** Qué pasa, en español: «Maniobras militares», «Minas»… */
	kind: string;
	/** El texto del aviso, en una línea y sin la cabecera. */
	text: string;
	/** ISO 8601 de emisión, si se pudo leer. */
	issued: string | null;
	/** Primer punto del aviso, para el mapa. */
	at: [number, number] | null;
}

export interface NavWarnData {
	items: NavWarning[];
}

/** Zonas que interesan, por cómo empieza el aviso, y su nombre en español. */
export const REGIONS: [RegExp, string][] = [
	[/^RED SEA/, 'Mar Rojo'],
	[/^GULF OF ADEN/, 'Golfo de Adén'],
	[/^(STRAIT OF HORMUZ|GULF OF OMAN)/, 'Ormuz y golfo de Omán'],
	[/^PERSIAN GULF/, 'Golfo Pérsico'],
	[/^ARABIAN SEA/, 'Mar Arábigo'],
	[/^BLACK SEA/, 'Mar Negro'],
	[/^SEA OF AZOV/, 'Mar de Azov'],
	[/^EASTERN MEDITERRANEAN/, 'Mediterráneo oriental'],
	[/^(SOUTH CHINA SEA|TAIWAN STRAIT|FORMOSA STRAIT)/, 'Mar de China Meridional y Taiwán'],
	[/^(YELLOW SEA|EAST CHINA SEA)/, 'Mar Amarillo y de China Oriental']
];

/** Lo que hace que un aviso sea de seguridad, con su nombre en español (gana el primero que encaja). */
export const KINDS: [RegExp, string][] = [
	[/\b(ATTACK|ATTACKED|HIJACK|PIRACY|PIRATE|ARMED|BOARDED|SUSPICIOUS APPROACH)/, 'Ataque o incidente'],
	[/\b(MINES?|MINING|MINE ?LIKE|MINEFIELD)\b/, 'Minas'],
	[/\b(MISSILE|ROCKET|SPACE DEBRIS)/, 'Misiles o cohetes'],
	[/\b(GNSS|GPS|JAMMING|SPOOFING|INTERFERENCE)\b/, 'Interferencias GPS'],
	[/\b(UNMANNED|DRONE|UAV|USV)\b/, 'Drones'],
	[/\b(GUNNERY|FIRING|LIVE FIRE|EXERCISES?|MILITARY|NAVAL|HAZARDOUS OPERATIONS)\b/, 'Maniobras militares'],
	[/\b(EXPLOSIVE|ORDNANCE|UXO)\b/, 'Explosivos']
];

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/** «081538Z MAY 2024» → «2024-05-08T15:38:00.000Z». */
export function navDate(s: string | null | undefined): string | null {
	const m = /^(\d{2})(\d{2})(\d{2})Z (\w{3}) (\d{4})$/.exec((s ?? '').trim());
	const month = m ? MONTHS.indexOf(m[4].toUpperCase()) : -1;
	if (!m || month < 0) return null;
	return new Date(Date.UTC(Number(m[5]), month, Number(m[1]), Number(m[2]), Number(m[3]))).toISOString();
}

/** Primer punto «26-09.23N 051-48.00E» del texto, en grados decimales. */
export function firstPoint(text: string): [number, number] | null {
	const m = /(\d{1,2})-(\d{1,2}(?:\.\d+)?)([NS])\s+(\d{1,3})-(\d{1,2}(?:\.\d+)?)([EW])/.exec(text);
	if (!m) return null;
	const lat = (Number(m[1]) + Number(m[2]) / 60) * (m[3] === 'S' ? -1 : 1);
	const lon = (Number(m[4]) + Number(m[5]) / 60) * (m[6] === 'W' ? -1 : 1);
	return [Math.round(lat * 100) / 100, Math.round(lon * 100) / 100];
}

/** Lo que se usa de cada aviso de /api/publications/broadcast-warn. */
export interface RawWarning {
	msgYear: number;
	msgNumber: number;
	navArea: string;
	text: string;
	issueDate?: string | null;
}

const AREA: Record<string, string> = { P: 'HYDROPAC', A: 'HYDROLANT', '4': 'NAVAREA IV', '12': 'NAVAREA XII' };

/** Un aviso de zona caliente y de seguridad, o null si es rutinario o de otra zona. */
export function toWarning(w: RawWarning): NavWarning | null {
	const lines = (w.text ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
	const head = lines[0] ?? '';
	const region = REGIONS.find(([re]) => re.test(head))?.[1];
	if (!region) return null;
	// Sin la cabecera: zona, lugar y la carta («DNC 10.»).
	const body = lines.slice(1).filter((l, i) => !(i <= 1 && /^DNC \d+\.?$/.test(l)));
	const place = body[0] && !/\d/.test(body[0]) && body[0].length < 40 ? placeName(body.shift()!.replace(/\.$/, '')) : '';
	const text = body.join(' ').replace(/\s+/g, ' ');
	const kind = KINDS.find(([re]) => re.test(text))?.[1];
	if (!kind) return null;
	return {
		id: `${AREA[w.navArea] ?? w.navArea} ${w.msgNumber}/${String(w.msgYear).slice(-2)}`,
		region,
		place,
		kind,
		text: text.length > 280 ? `${text.slice(0, 277)}…` : text,
		issued: navDate(w.issueDate),
		at: firstPoint(text)
	};
}

/** «UKRAINE» → «Ucrania»; lo que no es un país conocido, sin mayúsculas de télex: «KOREA» → «Korea». */
export function placeName(raw: string): string {
	const names = findCountries(raw).map((c) => c.name);
	return names.length ? names.join(', ') : raw.toLowerCase().replace(/(^|[\s/-])\p{L}/gu, (m) => m.toUpperCase());
}

/** Frase para el modo Sencillo. */
export function navSentence(items: Pick<NavWarning, 'region'>[]): string {
	if (!items.length) return '';
	const regions = [...new Set(items.map((i) => i.region))];
	return `Hay ${items.length === 1 ? 'un aviso' : `${items.length} avisos`} de seguridad a los barcos en ${regions.slice(0, 3).join(', ')}${regions.length > 3 ? ' y otras zonas' : ''}.`;
}
