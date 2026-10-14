// Calidad del aire, índice UV y polen en Menorca (Maó). API de calidad del aire de Open-Meteo, sin clave:
// sirve las previsiones del Servicio de Vigilancia Atmosférica de Copernicus (CAMS). Datos CC BY 4.0
// (Open-Meteo) con la atribución que pide Copernicus. Uso no comercial, menos de 10 000 llamadas al día.
import { AIR_API, airParams, parseAir as parseOpenMeteoAir } from '../../src/lib/openmeteo.ts';
import type { AirData } from '../../src/lib/weather.ts';
import { getJson, type Source } from '../lib.ts';

type Raw = Record<string, any>;

const MAO = { name: 'Maó', lat: 39.8885, lon: 4.2658 };

export const AIR_URL = `${AIR_API}?${airParams(MAO, 'Europe/Madrid')}`;

/** Convierte la respuesta de Open-Meteo en lo que pinta la vista WX (el lector está en src/lib/openmeteo.ts). */
export const parseAir = (raw: Raw): AirData => parseOpenMeteoAir(raw, MAO.name);

export const air: Source<AirData> = {
	name: 'air',
	label: 'Calidad del aire, UV y polen en Menorca · CAMS (Copernicus) vía Open-Meteo',
	maxAgeMinutes: 55,
	async fetch() {
		return parseAir(await getJson<Raw>(AIR_URL));
	}
};
