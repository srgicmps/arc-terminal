// Gasolineras: API abierta de precios de carburantes del Ministerio para la Transición Ecológica
// (sin clave). Reutilización libre citando la fuente y la fecha de los datos.
import {
	FUEL_FIELDS,
	FUELS,
	type FuelData,
	type FuelKey,
	type FuelPrices,
	type FuelProvince,
	type FuelProvinceDay,
	type FuelSpainData,
	type FuelStation
} from '../../src/lib/fuel.ts';
import { appendDaily, getJson, inRange, madridDay, num, pct, share, tidy, writeExtra, type Source } from '../lib.ts';

const API = 'https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/';

// Todos los códigos postales de Menorca empiezan por 077.
const MENORCA_CP = /^077\d\d$/;

// La API devuelve cada estación como un objeto de textos: «Rótulo», «Precio Gasolina 95 E5»…
type RawStation = Record<string, string | undefined>;

interface RawResponse {
	Fecha: string;
	ListaEESSPrecio: RawStation[];
}

async function download(path = ''): Promise<RawResponse> {
	const body = await getJson<RawResponse>(API + path);
	if (!Array.isArray(body.ListaEESSPrecio)) throw new Error('respuesta sin ListaEESSPrecio');
	return body;
}

/** «Mercadal (Es)» → «Es Mercadal»; «CORUÑA (A)» → «A Coruña». */
function town(value: string | undefined): string {
	const swapped = tidy(value).replace(/^(.+) \((.+)\)$/, '$2 $1');
	return swapped.charAt(0).toUpperCase() + swapped.slice(1);
}

function toStation(raw: RawStation): FuelStation | null {
	const lat = num(raw['Latitud']);
	const lon = num(raw['Longitud (WGS84)']);
	if (lat === null || lon === null) return null;
	const prices = Object.fromEntries(FUELS.map((f) => [f.key, num(raw[FUEL_FIELDS[f.key]])])) as FuelPrices;
	return {
		id: raw['IDEESS'] ?? '',
		name: tidy(raw['Rótulo'], true),
		address: tidy(raw['Dirección']),
		town: town(raw['Municipio']),
		schedule: (raw['Horario'] ?? '').trim(),
		lat,
		lon,
		prices
	};
}

/** Media y mínimo de cada combustible, con 3 decimales. */
function stats(stations: FuelStation[]): { avg: FuelPrices; min: FuelPrices } {
	const pick = (key: FuelKey, f: (v: number[]) => number) => {
		const v = stations.map((s) => s.prices[key]).filter((p): p is number => p !== null);
		return v.length ? Math.round(f(v) * 1000) / 1000 : null;
	};
	const avg = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
	const min = (v: number[]) => Math.min(...v);
	return {
		avg: Object.fromEntries(FUELS.map((f) => [f.key, pick(f.key, avg)])) as FuelPrices,
		min: Object.fromEntries(FUELS.map((f) => [f.key, pick(f.key, min)])) as FuelPrices
	};
}

/** ¿Tiene algún precio creíble (entre 0,5 y 4 €/L, con mucho margen sobre lo que se paga hoy)? */
const credible = (prices: FuelPrices) => FUELS.some((f) => inRange(prices[f.key], 0.5, 4));

/**
 * Para validate: datos raros si menos de la mitad de las gasolineras (o provincias) tienen algún precio
 * creíble. Si la API renombra el campo del precio, todas siguen ahí con los precios a null y checkShrink no
 * lo ve; si los diera en céntimos (159,9), tampoco.
 */
export function checkPrices(what: string, all: FuelPrices[]): string | null {
	const ok = share(all, credible);
	return ok < 0.5 ? `solo el ${pct(ok)} de las ${what} tiene algún precio entre 0,5 y 4 €/L` : null;
}

export const fuel: Source<FuelData> = {
	name: 'fuel',
	label: 'Gasolineras de Menorca · Ministerio para la Transición Ecológica',
	maxAgeMinutes: 12,
	validate: (data) => checkPrices('gasolineras', data.stations.map((s) => s.prices)),
	async fetch(previous) {
		const body = await download('FiltroProvincia/07');
		const stations = body.ListaEESSPrecio.filter((raw) => MENORCA_CP.test(raw['C.P.'] ?? ''))
			.map(toStation)
			.filter((station) => station !== null);
		// Menorca tiene unas 25 gasolineras: si no sale ninguna, algo ha cambiado en la API.
		if (stations.length === 0) throw new Error('ninguna estación de Menorca');
		const history = appendDaily(previous?.history, { date: madridDay(), ...stats(stations) });
		return { sourceDate: body.Fecha, stations, history };
	}
};

export const fuelSpain: Source<FuelSpainData> = {
	name: 'fuel-es',
	label: 'Gasolineras de toda España, por provincias · Ministerio para la Transición Ecológica',
	maxAgeMinutes: 25,
	files: (data) => data.provinces.flatMap((p) => [`fuel/${p.id}.json`, `fuel/history/${p.id}.json`]),
	validate: (data) =>
		checkPrices('provincias', data.provinces.map((p) => p.avg)) ??
		(credible(data.avg) ? null : 'la media de España no tiene ningún precio entre 0,5 y 4 €/L'),
	async fetch(previous) {
		const body = await download();
		const byProvince = new Map<string, { name: string; stations: FuelStation[] }>();
		for (const raw of body.ListaEESSPrecio) {
			const station = toStation(raw);
			const id = raw['IDProvincia'];
			if (!station || !id) continue;
			if (!byProvince.has(id)) byProvince.set(id, { name: town(raw['Provincia']), stations: [] });
			byProvince.get(id)!.stations.push(station);
		}
		if (byProvince.size < 40) throw new Error(`solo ${byProvince.size} provincias`);

		const provinces: FuelProvince[] = [];
		for (const [id, { name, stations }] of byProvince) {
			await writeExtra(`fuel/${id}.json`, stations);
			provinces.push({
				id,
				name,
				count: stations.length,
				lat: Math.round((stations.reduce((a, s) => a + s.lat, 0) / stations.length) * 1000) / 1000,
				lon: Math.round((stations.reduce((a, s) => a + s.lon, 0) / stations.length) * 1000) / 1000,
				...stats(stations)
			});
		}
		provinces.sort((a, b) => a.name.localeCompare(b.name, 'es'));
		const all = [...byProvince.values()].flatMap((p) => p.stations);
		const avg = stats(all).avg;
		// La API solo da el precio de hoy: el historial se va guardando día a día, con la media de España y
		// la de cada provincia. Medio año basta y así el archivo no crece demasiado.
		const byId = Object.fromEntries(provinces.map((p) => [p.id, p.avg]));
		const history = appendDaily(previous?.history, { date: madridDay(), avg, provinces: byId }, 180);
		// El historial de cada provincia también va en un archivo aparte, que FUEL pide al elegir la provincia:
		// así la vista no descarga los de las 52 provincias (es lo que más pesa de fuel-es.json).
		for (const { id } of provinces) {
			const days: FuelProvinceDay[] = history.flatMap((d) => (d.provinces?.[id] ? [{ date: d.date, avg: d.provinces[id] }] : []));
			await writeExtra(`fuel/history/${id}.json`, days);
		}
		return { sourceDate: body.Fecha, provinces, avg, history };
	}
};
