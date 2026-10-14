// Gasolineras de Menorca: API abierta de precios de carburantes del Ministerio para la Transición
// Ecológica (sin clave). Reutilización libre citando la fuente y la fecha de los datos.
import type { FuelData, FuelKey, FuelStation } from '../../src/lib/fuel.ts';
import { appendDaily, getJson, madridDay, num, tidy, type Source } from '../lib.ts';

// Estaciones de la provincia 07 (Illes Balears). No necesita clave.
const API_URL =
	'https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/FiltroProvincia/07';

// Todos los códigos postales de Menorca empiezan por 077.
const MENORCA_CP = /^077\d\d$/;

// La API devuelve cada estación como un objeto de textos: «Rótulo», «Precio Gasolina 95 E5»…
type RawStation = Record<string, string | undefined>;

interface RawResponse {
	Fecha: string;
	ListaEESSPrecio: RawStation[];
}

/** «Mercadal (Es)» → «Es Mercadal». */
function town(value: string | undefined): string {
	return tidy(value).replace(/^(.+) \((.+)\)$/, '$2 $1');
}

function toStation(raw: RawStation): FuelStation | null {
	const lat = num(raw['Latitud']);
	const lon = num(raw['Longitud (WGS84)']);
	if (lat === null || lon === null) return null;
	return {
		id: raw['IDEESS'] ?? '',
		name: tidy(raw['Rótulo'], true),
		address: tidy(raw['Dirección']),
		town: town(raw['Municipio']),
		schedule: (raw['Horario'] ?? '').trim(),
		lat,
		lon,
		prices: {
			g95: num(raw['Precio Gasolina 95 E5']),
			diesel: num(raw['Precio Gasoleo A'])
		}
	};
}

export const fuel: Source<FuelData> = {
	name: 'fuel',
	label: 'Precios de carburantes · Ministerio para la Transición Ecológica',
	maxAgeMinutes: 25,
	async fetch(previous) {
		const body = await getJson<RawResponse>(API_URL);
		if (!Array.isArray(body.ListaEESSPrecio)) throw new Error('respuesta sin ListaEESSPrecio');
		const stations = body.ListaEESSPrecio.filter((raw) => MENORCA_CP.test(raw['C.P.'] ?? ''))
			.map(toStation)
			.filter((station) => station !== null);
		// Menorca tiene unas 25 gasolineras: si no sale ninguna, algo ha cambiado en la API.
		if (stations.length === 0) throw new Error('ninguna estación de Menorca');
		const stat = (key: FuelKey, f: (v: number[]) => number) => {
			const v = stations.map((s) => s.prices[key]).filter((p): p is number => p !== null);
			return v.length ? Math.round(f(v) * 1000) / 1000 : null;
		};
		const avg = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
		const min = (v: number[]) => Math.min(...v);
		const history = appendDaily(previous?.history, {
			date: madridDay(),
			avg: { g95: stat('g95', avg), diesel: stat('diesel', avg) },
			min: { g95: stat('g95', min), diesel: stat('diesel', min) }
		});
		return { sourceDate: body.Fecha, stations, history };
	}
};
