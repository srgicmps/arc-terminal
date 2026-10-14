// Calidad del aire, índice UV y polen en Menorca (Maó). API de calidad del aire de Open-Meteo, sin clave:
// sirve las previsiones del Servicio de Vigilancia Atmosférica de Copernicus (CAMS). Datos CC BY 4.0
// (Open-Meteo) con la atribución que pide Copernicus. Uso no comercial, menos de 10 000 llamadas al día.
import {
	POLLEN_KEYS,
	type AirData,
	type AirDay,
	type AirHour,
	type Pollen
} from '../../src/lib/weather.ts';
import { getJson, list, num, type Source } from '../lib.ts';

type Raw = Record<string, any>;

const MAO = { name: 'Maó', lat: 39.8885, lon: 4.2658 };

// Nombre de cada dato en la API (el polen solo existe en el dominio europeo y en temporada).
const POLLEN_VARS = POLLEN_KEYS.map((k) => `${k}_pollen`);
const NOW_VARS = ['european_aqi', 'pm2_5', 'pm10', 'ozone', 'nitrogen_dioxide', 'uv_index', ...POLLEN_VARS];
const HOURLY_VARS = ['european_aqi', 'uv_index', ...POLLEN_VARS];

export const AIR_URL =
	'https://air-quality-api.open-meteo.com/v1/air-quality?' +
	new URLSearchParams({
		latitude: String(MAO.lat),
		longitude: String(MAO.lon),
		current: NOW_VARS.join(','),
		hourly: HOURLY_VARS.join(','),
		timezone: 'Europe/Madrid',
		forecast_days: '4'
	});

const pollenFrom = (get: (name: string) => number | null): Pollen =>
	Object.fromEntries(POLLEN_KEYS.map((k) => [k, get(`${k}_pollen`)]));

const maxOf = (values: (number | null)[]): number | null => {
	const ok = values.filter((v): v is number => v !== null);
	return ok.length ? Math.max(...ok) : null;
};

/** Convierte la respuesta de Open-Meteo en lo que pinta la vista WX. */
export function parseAir(raw: Raw): AirData {
	const c = raw?.current ?? {};
	const h = raw?.hourly ?? {};
	const times = list<string>(h.time);
	const at = (name: string, i: number) => num(h[name]?.[i]);

	const now = {
		time: String(c.time ?? ''),
		aqi: num(c.european_aqi),
		pm25: num(c.pm2_5),
		pm10: num(c.pm10),
		o3: num(c.ozone),
		no2: num(c.nitrogen_dioxide),
		uv: num(c.uv_index),
		pollen: pollenFrom((name) => num(c[name]))
	};

	// Próximas 24 horas, de 3 en 3, a partir de la hora actual (las horas vienen en hora local).
	const start = Math.max(0, times.findIndex((t) => t >= now.time));
	const hours: AirHour[] = [];
	for (let i = start; i < Math.min(times.length, start + 24); i += 3) {
		hours.push({ time: times[i], aqi: at('european_aqi', i), uv: at('uv_index', i) });
	}

	// Máximo de cada día.
	const dates = [...new Set(times.map((t) => t.slice(0, 10)))];
	const days: AirDay[] = dates.map((date) => {
		const idx = times.flatMap((t, i) => (t.startsWith(date) ? [i] : []));
		const max = (name: string) => maxOf(idx.map((i) => at(name, i)));
		return { date, aqi: max('european_aqi'), uv: max('uv_index'), pollen: pollenFrom(max) };
	});

	if (now.aqi === null && !days.some((d) => d.aqi !== null)) throw new Error('sin datos de calidad del aire');
	return { place: MAO.name, now, hours, days };
}

export const air: Source<AirData> = {
	name: 'air',
	label: 'Calidad del aire, UV y polen en Menorca · CAMS (Copernicus) vía Open-Meteo',
	maxAgeMinutes: 55,
	async fetch() {
		return parseAir(await getJson<Raw>(AIR_URL));
	}
};
