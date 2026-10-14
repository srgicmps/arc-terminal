// Gasto militar por país del SIPRI (Military Expenditure Database), del Excel anual. Funciones puras: las
// usa scripts/sources/sipri.ts y se prueban sin el archivo.
// Hojas que se leen: «Current US$» (millones de dólares corrientes, para el puesto), «Constant (… ) US$»
// (millones de dólares constantes, para la variación real) y «Share of GDP» (fracción del PIB).
import { COUNTRIES } from './countries.ts';

export interface MilexRow {
	/** ISO 3166-1 alfa-2, si se reconoce el nombre del SIPRI; null si no. */
	code: string | null;
	/** Nombre en español (o el del SIPRI si no se reconoce). */
	name: string;
	/** Puesto mundial por gasto en dólares corrientes (1 = el que más gasta). */
	rank: number;
	/** Gasto del último año, en millones de dólares corrientes. */
	usd: number;
	/** Gasto en % del PIB. */
	gdp: number | null;
	/** Variación real frente al año anterior (dólares constantes), en %. */
	real: number | null;
}

export interface MilexData {
	/** Último año con datos: 2025. */
	year: number;
	/** Todos los países con dato ese año, del que más gasta al que menos. */
	rows: MilexRow[];
}

/** Una hoja como matriz de celdas, con su nombre. */
export interface Sheet {
	name: string;
	cells: unknown[][];
}

const fold = (s: string) =>
	s
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z]/g, '');

// Nombres del SIPRI que no coinciden con los de Intl.DisplayNames en inglés.
const SIPRI_NAMES: Record<string, string> = {
	unitedstatesofamerica: 'US',
	koreasouth: 'KR',
	koreanorth: 'KP',
	southkorea: 'KR',
	northkorea: 'KP',
	turkey: 'TR',
	turkiye: 'TR',
	congodr: 'CD',
	drcongo: 'CD',
	democraticrepublicofthecongo: 'CD',
	congorepublic: 'CG',
	congo: 'CG',
	uae: 'AE',
	czechrepublic: 'CZ',
	cotedivoire: 'CI',
	vietnam: 'VN',
	vietnamsocialistrepublic: 'VN',
	bosniaandherzegovina: 'BA',
	northmacedonia: 'MK',
	macedonianorth: 'MK',
	eswatini: 'SZ',
	swaziland: 'SZ',
	gambiathe: 'GM',
	gambia: 'GM',
	capeverde: 'CV',
	caboverde: 'CV',
	timorleste: 'TL',
	brunei: 'BN',
	laos: 'LA',
	myanmar: 'MM',
	russia: 'RU',
	syria: 'SY',
	iran: 'IR',
	moldova: 'MD',
	taiwan: 'TW',
	palestine: 'PS',
	kosovo: 'XK'
};

let byName: Map<string, string> | null = null;

/** Código ISO de un país a partir de su nombre en inglés (como lo escribe el SIPRI); null si no lo conoce. */
export function countryCode(name: string): string | null {
	if (!byName) {
		byName = new Map();
		const en = new Intl.DisplayNames('en', { type: 'region' });
		const A = 'A'.charCodeAt(0);
		for (let i = 0; i < 26; i++) {
			for (let j = 0; j < 26; j++) {
				const code = String.fromCharCode(A + i, A + j);
				const label = en.of(code);
				if (label && label !== code) byName.set(fold(label), code);
			}
		}
		for (const c of COUNTRIES) for (const a of c.aliases ?? []) if (!byName.has(fold(a))) byName.set(fold(a), c.code);
	}
	const key = fold(name);
	return SIPRI_NAMES[key] ?? byName.get(key) ?? null;
}

/** Nombre en español: el de la terminal si es un país conocido, si no el de Intl, y si no el del SIPRI. */
export function spanishName(code: string | null, fallback: string): string {
	if (!code) return fallback;
	const known = COUNTRIES.find((c) => c.code === code);
	if (known) return known.name;
	try {
		return new Intl.DisplayNames('es', { type: 'region' }).of(code) ?? fallback;
	} catch {
		return fallback;
	}
}

/** Una hoja de años por país: { «Spain»: { 2024: 21000, 2025: 23000 } }. Las celdas «...» o «xxx» no cuentan. */
export function yearTable(cells: unknown[][]): { years: number[]; values: Map<string, Map<number, number>> } {
	const head = cells.findIndex((r) => String(r[0] ?? '').trim() === 'Country');
	const values = new Map<string, Map<number, number>>();
	if (head < 0) return { years: [], values };
	const cols = cells[head].flatMap((c, i) => (/^\d{4}$/.test(String(c ?? '').trim()) ? [{ i, year: Number(c) }] : []));
	for (const row of cells.slice(head + 1)) {
		const name = String(row[0] ?? '').trim();
		if (!name) continue;
		const byYear = new Map<number, number>();
		for (const { i, year } of cols) {
			const v = row[i];
			if (typeof v === 'number' && Number.isFinite(v)) byYear.set(year, v);
		}
		if (byYear.size) values.set(name, byYear);
	}
	return { years: cols.map((c) => c.year), values };
}

/** Lee las tres hojas y devuelve el último año con datos de Estados Unidos y todos los países de ese año. */
export function parseMilex(sheets: Sheet[]): MilexData | null {
	const find = (re: RegExp) => sheets.find((s) => re.test(s.name));
	const current = find(/^current us\$/i);
	if (!current) return null;
	const cur = yearTable(current.cells);
	const constant = yearTable(find(/^constant/i)?.cells ?? []);
	const share = yearTable(find(/^share of gdp/i)?.cells ?? []);
	// El año es el último que tiene el país que siempre publica: Estados Unidos.
	const us = cur.values.get('United States of America');
	const year = Math.max(...(us ? [...us.keys()] : [0]));
	if (!year) return null;
	// El % del PIB viene como fracción (0,013 = 1,3 %); si alguna vez viniera en %, se deja como está.
	const allShares = [...share.values.values()].flatMap((m) => [...m.values()]);
	const factor = allShares.length && Math.max(...allShares) <= 1 ? 100 : 1;
	const rows = [...cur.values.entries()]
		.flatMap(([sipri, byYear]) => {
			const usd = byYear.get(year);
			if (usd === undefined || usd <= 0) return [];
			const code = countryCode(sipri);
			const k = constant.values.get(sipri);
			const now = k?.get(year);
			const before = k?.get(year - 1);
			const g = share.values.get(sipri)?.get(year);
			return [
				{
					code,
					name: spanishName(code, sipri),
					usd,
					gdp: g === undefined ? null : Math.round(g * factor * 100) / 100,
					real: now !== undefined && before ? Math.round(((now - before) / before) * 1000) / 10 : null
				}
			];
		})
		.sort((a, b) => b.usd - a.usd)
		.map((r, i) => ({ ...r, rank: i + 1 }));
	return { year, rows };
}
