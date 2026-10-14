/// <reference types="node" />
// Descarga los precios de las gasolineras de Menorca de la API abierta del Ministerio y los guarda,
// ya limpios, en data/fuel.json. Lo ejecuta GitHub Actions antes de construir la web.
// En local: `pnpm fuel`.
import { mkdir, writeFile } from 'node:fs/promises';
import type { FuelData, FuelStation } from '../src/lib/fuel.ts';

// Estaciones de la provincia 07 (Illes Balears). No necesita clave.
const API_URL =
	'https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/FiltroProvincia/07';
const OUT_FILE = 'data/fuel.json';
const ATTEMPTS = 3;

// Todos los códigos postales de Menorca empiezan por 077.
const MENORCA_CP = /^077\d\d$/;

// La API devuelve cada estación como un objeto de textos: «Rótulo», «Precio Gasolina 95 E5»…
type RawStation = Record<string, string | undefined>;

interface RawResponse {
	Fecha: string;
	ListaEESSPrecio: RawStation[];
}

async function download(): Promise<RawResponse> {
	for (let attempt = 1; ; attempt++) {
		try {
			const res = await fetch(API_URL, {
				headers: { Accept: 'application/json' },
				signal: AbortSignal.timeout(60_000)
			});
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const body = (await res.json()) as RawResponse;
			if (!Array.isArray(body.ListaEESSPrecio)) throw new Error('respuesta sin ListaEESSPrecio');
			return body;
		} catch (error) {
			if (attempt === ATTEMPTS) throw error;
			console.warn(`Intento ${attempt} fallido (${error}). Reintento en ${attempt * 10} s…`);
			await new Promise((resolve) => setTimeout(resolve, attempt * 10_000));
		}
	}
}

/** «1,599» → 1.599; vacío → null. La API usa coma decimal. */
function number(value: string | undefined): number | null {
	const n = Number.parseFloat((value ?? '').replace(',', '.'));
	return Number.isFinite(n) ? n : null;
}

const SMALL_WORDS = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'y', 'a', 'en', 's/n']);

/** La API escribe muchos textos en mayúsculas: «CARRETERA ME-1 KM 12» → «Carretera ME-1 Km 12». */
function tidy(value: string | undefined, keepShort = false): string {
	const text = (value ?? '').trim().replace(/\s+/g, ' ');
	if (text !== text.toUpperCase()) return text;
	return text
		.toLowerCase()
		.split(' ')
		.map((word, i) => {
			if (i > 0 && SMALL_WORDS.has(word)) return word;
			if (/\d/.test(word) || (keepShort && word.length <= 3)) return word.toUpperCase();
			return word.charAt(0).toUpperCase() + word.slice(1);
		})
		.join(' ');
}

/** «Mercadal (Es)» → «Es Mercadal». */
function town(value: string | undefined): string {
	return tidy(value).replace(/^(.+) \((.+)\)$/, '$2 $1');
}

function toStation(raw: RawStation): FuelStation | null {
	const lat = number(raw['Latitud']);
	const lon = number(raw['Longitud (WGS84)']);
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
			g95: number(raw['Precio Gasolina 95 E5']),
			diesel: number(raw['Precio Gasoleo A'])
		}
	};
}

const body = await download();
const stations = body.ListaEESSPrecio.filter((raw) => MENORCA_CP.test(raw['C.P.'] ?? ''))
	.map(toStation)
	.filter((station) => station !== null);

// Menorca tiene unas 30 gasolineras: si no sale ninguna, algo ha cambiado en la API.
if (stations.length === 0) throw new Error('La API no ha devuelto ninguna estación de Menorca');

const data: FuelData = {
	sourceDate: body.Fecha,
	fetchedAt: new Date().toISOString(),
	stations
};

await mkdir('data', { recursive: true });
await writeFile(OUT_FILE, JSON.stringify(data, null, '\t') + '\n');
console.log(`${OUT_FILE}: ${stations.length} estaciones de Menorca, datos del ${body.Fecha}`);
