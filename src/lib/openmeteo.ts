// Open-Meteo (sin clave, CC BY 4.0): cómo se piden y cómo se leen el tiempo, el aire y el mar. Lo usan la
// Action (scripts/sources/world.ts y air.ts, para los sitios fijos) y el navegador (localweather.ts, para el
// sitio que elija cada uno), así los dos leen los datos igual.
import type { WeatherPlace } from './types.ts';
import {
	POLLEN_KEYS,
	type AirData,
	type AirDay,
	type AirHour,
	type Pollen,
	type SeaState,
	type SunDay
} from './weather.ts';

type Raw = Record<string, any>;

/** Número de la API o null (Open-Meteo devuelve null cuando no hay dato). */
const n = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const arr = <T>(v: T[] | null | undefined): T[] => (Array.isArray(v) ? v : []);

// ---------- Tiempo ----------

export const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

/** Parámetros del pronóstico para uno o varios puntos (una sola petición). */
export function forecastParams(points: { lat: number; lon: number }[]): URLSearchParams {
	return new URLSearchParams({
		latitude: points.map((p) => p.lat).join(','),
		longitude: points.map((p) => p.lon).join(','),
		current: 'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m',
		daily:
			'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,' +
			'sunrise,sunset,daylight_duration',
		timezone: 'auto',
		// Un día de atrás para comparar la duración del día con la de ayer; en la tabla no se enseña.
		past_days: '1',
		forecast_days: '7'
	});
}

/** «2026-10-14T07:52» en hora local + desfase en segundos → ISO en UTC. */
function localToIso(local: unknown, offset: number): string | null {
	const t = Date.parse(`${String(local ?? '')}Z`);
	return Number.isFinite(t) ? new Date(t - offset * 1000).toISOString() : null;
}

/** Sol del día `i` de la lista diaria (hoy) y diferencia de luz con el día anterior, si lo hay. */
export function parseSun(d: Raw, offset: number, i: number): SunDay | null {
	const sunrise = localToIso(d.sunrise?.[i], offset);
	const sunset = localToIso(d.sunset?.[i], offset);
	const daylight = n(d.daylight_duration?.[i]);
	if (!sunrise || !sunset || daylight === null) return null;
	const yesterday = i > 0 ? n(d.daylight_duration?.[i - 1]) : null;
	return {
		sunrise,
		sunset,
		daylight,
		delta: yesterday === null ? null : daylight - yesterday
	};
}

/** Un sitio a partir de su respuesta del pronóstico; `sea` es la temperatura del agua, si la hay. */
export function parsePlace(f: Raw, name: string, sea: number | null): WeatherPlace {
	const d = f?.daily ?? {};
	const times = arr<string>(d.time);
	// La lista empieza ayer (past_days=1): la tabla arranca hoy, según la hora actual del sitio.
	const first = Math.max(0, times.indexOf(String(f?.current?.time ?? '').slice(0, 10)));
	return {
		name,
		current: {
			time: String(f?.current?.time ?? ''),
			temp: Number(f?.current?.temperature_2m),
			code: Number(f?.current?.weather_code),
			wind: Number(f?.current?.wind_speed_10m),
			windDir: Number(f?.current?.wind_direction_10m),
			humidity: Number(f?.current?.relative_humidity_2m)
		},
		daily: times
			.map((date, j) => ({
				date,
				code: Number(d.weather_code?.[j]),
				max: Number(d.temperature_2m_max?.[j]),
				min: Number(d.temperature_2m_min?.[j]),
				rain: Number(d.precipitation_probability_max?.[j] ?? 0),
				wind: Number(d.wind_speed_10m_max?.[j])
			}))
			.slice(first),
		sea,
		sun: parseSun(d, n(f?.utc_offset_seconds) ?? 0, first)
	};
}

// ---------- Mar ----------

export const MARINE_URL = 'https://marine-api.open-meteo.com/v1/marine';

const MARINE_NOW = [
	'sea_surface_temperature',
	'wave_height',
	'wave_direction',
	'wave_period',
	'swell_wave_height',
	'swell_wave_direction',
	'swell_wave_period'
];
const MARINE_DAILY = ['wave_height_max', 'swell_wave_height_max', 'wave_direction_dominant'];

/** Parámetros del modelo marino para uno o varios puntos (una sola petición). */
export function marineParams(points: { lat: number; lon: number }[], timezone = 'auto'): URLSearchParams {
	return new URLSearchParams({
		latitude: points.map((p) => p.lat).join(','),
		longitude: points.map((p) => p.lon).join(','),
		current: MARINE_NOW.join(','),
		daily: MARINE_DAILY.join(','),
		timezone,
		forecast_days: '3'
	});
}

/** Temperatura del agua de una respuesta del modelo marino (null si el punto es de interior). */
export const seaTemp = (raw: Raw): number | null => n(raw?.current?.sea_surface_temperature);

/** Oleaje de un punto; null si el modelo no da olas (punto de interior). */
export function parseSea(raw: Raw, name: string, spot: string): SeaState | null {
	const c = raw?.current ?? {};
	const d = raw?.daily ?? {};
	const state: SeaState = {
		name,
		spot,
		now: {
			wave: n(c.wave_height),
			waveDir: n(c.wave_direction),
			wavePeriod: n(c.wave_period),
			swell: n(c.swell_wave_height),
			swellDir: n(c.swell_wave_direction),
			swellPeriod: n(c.swell_wave_period),
			water: n(c.sea_surface_temperature)
		},
		daily: arr<string>(d.time).map((date, j) => ({
			date,
			waveMax: n(d.wave_height_max?.[j]),
			swellMax: n(d.swell_wave_height_max?.[j]),
			dir: n(d.wave_direction_dominant?.[j])
		}))
	};
	const empty = state.now.wave === null && !state.daily.some((x) => x.waveMax !== null);
	return empty ? null : state;
}

// ---------- Aire, UV y polen (CAMS) ----------

export const AIR_API = 'https://air-quality-api.open-meteo.com/v1/air-quality';

// Nombre de cada dato en la API (el polen solo existe en el dominio europeo y en temporada).
const POLLEN_VARS = POLLEN_KEYS.map((k) => `${k}_pollen`);
const NOW_VARS = ['european_aqi', 'pm2_5', 'pm10', 'ozone', 'nitrogen_dioxide', 'uv_index', ...POLLEN_VARS];
const HOURLY_VARS = ['european_aqi', 'uv_index', ...POLLEN_VARS];

/** Parámetros del aire para un punto, en la zona horaria indicada (por defecto, la del sitio). */
export function airParams(point: { lat: number; lon: number }, timezone = 'auto'): URLSearchParams {
	return new URLSearchParams({
		latitude: String(point.lat),
		longitude: String(point.lon),
		current: NOW_VARS.join(','),
		hourly: HOURLY_VARS.join(','),
		timezone,
		forecast_days: '4'
	});
}

const pollenFrom = (get: (name: string) => number | null): Pollen =>
	Object.fromEntries(POLLEN_KEYS.map((k) => [k, get(`${k}_pollen`)]));

const maxOf = (values: (number | null)[]): number | null => {
	const ok = values.filter((v): v is number => v !== null);
	return ok.length ? Math.max(...ok) : null;
};

/** Convierte la respuesta de calidad del aire en lo que pinta la vista WX. */
export function parseAir(raw: Raw, place: string): AirData {
	const c = raw?.current ?? {};
	const h = raw?.hourly ?? {};
	const times = arr<string>(h.time);
	const at = (name: string, i: number) => n(h[name]?.[i]);

	const now = {
		time: String(c.time ?? ''),
		aqi: n(c.european_aqi),
		pm25: n(c.pm2_5),
		pm10: n(c.pm10),
		o3: n(c.ozone),
		no2: n(c.nitrogen_dioxide),
		uv: n(c.uv_index),
		pollen: pollenFrom((name) => n(c[name]))
	};

	// Próximas 24 horas, de 3 en 3, a partir de la hora actual (las horas vienen en hora local).
	const start = Math.max(
		0,
		times.findIndex((t) => t >= now.time)
	);
	const hours: AirHour[] = [];
	for (let i = start; i < Math.min(times.length, start + 24); i += 3) {
		hours.push({
			time: times[i],
			aqi: at('european_aqi', i),
			uv: at('uv_index', i)
		});
	}

	// Máximo de cada día.
	const dates = [...new Set(times.map((t) => t.slice(0, 10)))];
	const days: AirDay[] = dates.map((date) => {
		const idx = times.flatMap((t, i) => (t.startsWith(date) ? [i] : []));
		const max = (name: string) => maxOf(idx.map((i) => at(name, i)));
		return {
			date,
			aqi: max('european_aqi'),
			uv: max('uv_index'),
			pollen: pollenFrom(max)
		};
	});

	if (now.aqi === null && !days.some((d) => d.aqi !== null)) throw new Error('sin datos de calidad del aire');
	return { place, now, hours, days };
}
