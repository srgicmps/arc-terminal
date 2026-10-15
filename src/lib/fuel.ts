// Forma de los datos de gasolineras. La comparten los scripts (scripts/sources/fuel.ts) y la vista FUEL.
//  - static/data/fuel.json: Menorca, con historial diario.
//  - static/data/fuel-es.json: índice de provincias con precios medios.
//  - static/data/fuel/<id de provincia>.json: gasolineras de cada provincia (se cargan al elegirla).
import { inMenorca } from './place.ts';

export type FuelKey = 'g95' | 'diesel' | 'g98' | 'glp';

export const FUELS: { key: FuelKey; label: string }[] = [
	{ key: 'g95', label: 'Gasolina 95' },
	{ key: 'diesel', label: 'Diésel' },
	{ key: 'g98', label: 'Gasolina 98' },
	{ key: 'glp', label: 'GLP' }
];

/** Campos de la API del Ministerio para cada combustible. */
export const FUEL_FIELDS: Record<FuelKey, string> = {
	g95: 'Precio Gasolina 95 E5',
	diesel: 'Precio Gasoleo A',
	g98: 'Precio Gasolina 98 E5',
	glp: 'Precio Gases licuados del petróleo'
};

export type FuelPrices = Record<FuelKey, number | null>;

export interface FuelStation {
	id: string;
	name: string;
	address: string;
	town: string;
	schedule: string;
	lat: number;
	lon: number;
	/** €/L, o null si la estación no vende ese combustible. */
	prices: FuelPrices;
}

/** Un día del historial: precio medio y mínimo de Menorca. */
export interface FuelDay {
	date: string;
	avg: FuelPrices;
	min: FuelPrices;
}

export interface FuelData {
	/** Fecha de los datos según el Ministerio, tal cual la publica: «14/10/2026 12:30:05». */
	sourceDate: string;
	stations: FuelStation[];
	/** Historial diario que va acumulando la propia web (la API solo da el precio de hoy). */
	history?: FuelDay[];
}

export interface FuelProvince {
	id: string;
	name: string;
	count: number;
	/** Centro aproximado (media de sus gasolineras), para «cerca de mí». */
	lat: number;
	lon: number;
	avg: FuelPrices;
	min: FuelPrices;
}

/** Un día del historial de España: precio medio de todas las gasolineras y de cada provincia. */
export interface FuelSpainDay {
	date: string;
	avg: FuelPrices;
	/** Precio medio de cada provincia, por su id. */
	provinces?: Record<string, FuelPrices>;
}

/** Un día del historial de una provincia (static/data/fuel/history/<id>.json). */
export interface FuelProvinceDay {
	date: string;
	avg: FuelPrices;
}

export interface FuelSpainData {
	sourceDate: string;
	provinces: FuelProvince[];
	/** Media de toda España. */
	avg: FuelPrices;
	/** Historial diario de la media de España que va acumulando la propia web. */
	history?: FuelSpainDay[];
}

/** Distancia en km entre dos puntos (fórmula del haversine). */
export function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
	const rad = Math.PI / 180;
	const dLat = (b.lat - a.lat) * rad;
	const dLon = (b.lon - a.lon) * rad;
	const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
	return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** Más allá de esta distancia al centro de la provincia más cercana, «cerca de mí» entiende que estás fuera de España. */
export const NEAR_MAX_KM = 300;

/**
 * «Cerca de mí»: la zona de FUEL para una posición. Menorca si está en la isla (es una zona aparte); si no, la
 * provincia con el centro más cercano, siempre que esté a menos de `NEAR_MAX_KM`. null si no hay ninguna cerca.
 */
export function nearestZone(me: { lat: number; lon: number }, provinces: Pick<FuelProvince, 'id' | 'lat' | 'lon'>[]): string | null {
	if (inMenorca(me)) return 'menorca';
	let best: { id: string; km: number } | null = null;
	for (const p of provinces) {
		const km = distanceKm(me, p);
		if (!best || km < best.km) best = { id: p.id, km };
	}
	return best && best.km <= NEAR_MAX_KM ? best.id : null;
}

/**
 * La zona que pide la barra con «FUEL Madrid» o «FUEL 28»: Menorca, el número de la provincia
 * o su nombre (sin tildes; exacto, por el principio o contenido). null si no la encuentra.
 */
export function findProvince(raw: string | null, provinces: Pick<FuelProvince, 'id' | 'name'>[]): string | null {
	const clean = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
	const q = clean(raw ?? '');
	if (!q) return null;
	if (q === 'menorca') return 'menorca';
	if (/^\d{1,2}$/.test(q)) return provinces.find((p) => p.id === q.padStart(2, '0'))?.id ?? null;
	const named = provinces.map((p) => ({ id: p.id, name: clean(p.name) }));
	const hit =
		named.find((p) => p.name === q) ?? named.find((p) => p.name.startsWith(q)) ?? named.find((p) => p.name.includes(q));
	return hit?.id ?? null;
}

/**
 * Zona de FUEL para «Tu sitio»: Menorca si está en la isla; si está en España, su provincia (por admin2,
 * admin1 o el nombre, y si no encaja entero, por su palabra más larga: «Illes Balears» → «Balears (Illes)»);
 * fuera de España, null.
 */
export function zoneFor(
	p: { name: string; cc: string; lat: number; lon: number; admin1?: string; admin2?: string },
	provinces: Pick<FuelProvince, 'id' | 'name'>[]
): string | null {
	if (inMenorca(p)) return 'menorca';
	if (p.cc !== 'ES') return null;
	const names = [p.admin2, p.admin1, p.name].filter((n): n is string => !!n);
	for (const n of names) {
		const id = findProvince(n, provinces);
		if (id && id !== 'menorca') return id;
	}
	for (const n of names) {
		const word = [...n.split(/[\s/-]+/)].sort((a, b) => b.length - a.length)[0];
		const id = word && word.length >= 4 ? findProvince(word, provinces) : null;
		if (id && id !== 'menorca') return id;
	}
	return null;
}

// ---------- España frente a Europa (Weekly Oil Bulletin de la Comisión Europea) ----------

/** Países que se comparan, en el orden de la tabla; EU es la media ponderada de la UE. */
export const EU_COUNTRIES = [
	{ code: 'ES', name: 'España' },
	{ code: 'FR', name: 'Francia' },
	{ code: 'DE', name: 'Alemania' },
	{ code: 'IT', name: 'Italia' },
	{ code: 'PT', name: 'Portugal' },
	{ code: 'EU', name: 'Media UE' }
] as const;

/** Precio de un carburante en €/L, con y sin impuestos. */
export interface TaxedPrice {
	tax: number | null;
	net: number | null;
}

export interface EuFuelRow {
	code: string;
	name: string;
	g95: TaxedPrice;
	diesel: TaxedPrice;
}

export interface EuFuelData {
	/** Lunes al que se refieren los precios: «2026-10-12». */
	date: string;
	rows: EuFuelRow[];
}

/** Parte del precio que son impuestos (IVA e impuestos especiales), en %; null si falta alguno de los dos precios. */
export function taxShare(p: TaxedPrice): number | null {
	return p.tax && p.net !== null ? ((p.tax - p.net) / p.tax) * 100 : null;
}

/** El día de una celda de fecha (un Date o «2026-10-12»); si no lo es, null. */
function dayOf(cell: unknown): string | null {
	if (cell instanceof Date && !Number.isNaN(cell.getTime())) return cell.toISOString().slice(0, 10);
	const s = String(cell ?? '').trim();
	return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
}

/**
 * Lee las hojas del histórico del Oil Bulletin («Prices with taxes» y «Prices wo taxes»), ya convertidas
 * en matrices de celdas. La primera fila nombra cada columna («ES_price_with_tax_euro95»,
 * «EU_price_wo_tax_diesel»…) y las filas de datos empiezan por la fecha. Se queda con la semana más
 * reciente que tenga precio de España. Los precios vienen en € por 1.000 L y se pasan a €/L.
 */
export function parseOilBulletin(sheets: unknown[][][]): EuFuelData | null {
	type Key = `${string}_${'with' | 'wo'}_${'euro95' | 'diesel'}`;
	const byDate = new Map<string, Map<Key, number>>();
	for (const cells of sheets) {
		const head = (cells[0] ?? []).map((c) => String(c ?? '').trim());
		const cols = head.flatMap((h, i) => {
			const m = /^([A-Z]{2})_price_(with|wo)_tax_(euro95|diesel)$/i.exec(h);
			return m ? [{ i, key: `${m[1].toUpperCase()}_${m[2].toLowerCase()}_${m[3].toLowerCase()}` as Key }] : [];
		});
		if (!cols.length) continue;
		for (const row of cells.slice(1)) {
			const date = dayOf(row[0]);
			if (!date) continue;
			const values = byDate.get(date) ?? new Map<Key, number>();
			for (const { i, key } of cols) {
				const v = Number(row[i]);
				if (row[i] !== null && row[i] !== '' && Number.isFinite(v) && v > 0) values.set(key, v);
			}
			byDate.set(date, values);
		}
	}
	const date = [...byDate.keys()].sort().reverse().find((d) => byDate.get(d)?.has('ES_with_euro95'));
	if (!date) return null;
	const values = byDate.get(date)!;
	const litre = (key: Key) => {
		const v = values.get(key);
		return v === undefined ? null : Math.round(v) / 1000;
	};
	const rows = EU_COUNTRIES.map(({ code, name }) => ({
		code,
		name,
		g95: { tax: litre(`${code}_with_euro95`), net: litre(`${code}_wo_euro95`) },
		diesel: { tax: litre(`${code}_with_diesel`), net: litre(`${code}_wo_diesel`) }
	})).filter((r) => r.g95.tax !== null || r.diesel.tax !== null);
	return { date, rows };
}
