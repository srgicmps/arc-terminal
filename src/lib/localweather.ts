// Tiempo, aire, UV, polen, mar y sol del sitio elegido (place.svelte.ts), pedidos a Open-Meteo desde el
// navegador (sin clave, con CORS). Se guardan 30 min en este navegador para no repetir peticiones al cambiar
// de vista. Si fallan, las vistas siguen con static/data/weather.json y air.json (los sitios fijos).
import {
	AIR_API,
	FORECAST_URL,
	MARINE_URL,
	airParams,
	forecastParams,
	marineParams,
	parseAir,
	parsePlace,
	parseSea
} from './openmeteo.ts';
import type { Place } from './place.ts';
import type { WeatherPlace } from './types.ts';
import type { AirData, SeaState } from './weather.ts';

export interface LocalWeather {
	/** ISO 8601 de cuándo se pidió. */
	fetchedAt: string;
	/** Zona horaria del sitio según Open-Meteo. */
	tz: string;
	weather: WeatherPlace;
	/** null si CAMS no tiene datos de ese punto. */
	air: AirData | null;
	/** Oleaje frente al sitio; null si es de interior. */
	sea: SeaState | null;
}

const PREFIX = 'arc-localwx:';
const MAX_AGE = 30 * 60_000;

/** Clave de caché: coordenadas redondeadas a unos 100 m. */
export const cacheKey = (p: Place) => `${PREFIX}${p.lat.toFixed(3)},${p.lon.toFixed(3)}`;

function readCache(p: Place, now: number): LocalWeather | null {
	try {
		const c = JSON.parse(localStorage.getItem(cacheKey(p)) ?? 'null') as LocalWeather | null;
		return c && now - Date.parse(c.fetchedAt) < MAX_AGE ? c : null;
	} catch {
		return null;
	}
}

function writeCache(p: Place, data: LocalWeather) {
	try {
		// Solo se guarda el último sitio: los demás se borran para no llenar el almacenamiento.
		for (const k of Object.keys(localStorage)) if (k.startsWith(PREFIX)) localStorage.removeItem(k);
		localStorage.setItem(cacheKey(p), JSON.stringify(data));
	} catch {}
}

async function json(url: string, signal?: AbortSignal): Promise<Record<string, any>> {
	const res = await fetch(url, { signal });
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	return res.json();
}

/** ¿La celda de mar que devuelve Open-Meteo está a menos de unos 25 km del sitio? */
export function nearSea(marine: Record<string, any>, p: Place): boolean {
	const lat = Number(marine.latitude);
	const lon = Number(marine.longitude);
	if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
	const km = Math.hypot((lat - p.lat) * 111, (lon - p.lon) * 111 * Math.cos((p.lat * Math.PI) / 180));
	return km < 25;
}

/** Lo pide todo a la vez; solo el pronóstico es imprescindible (el aire y el mar pueden faltar). */
export async function fetchLocal(p: Place, signal?: AbortSignal): Promise<LocalWeather> {
	const cached = readCache(p, Date.now());
	if (cached) return cached;

	const point = [{ lat: p.lat, lon: p.lon }];
	const [forecast, airRaw, marine] = await Promise.all([
		json(`${FORECAST_URL}?${forecastParams(point)}`, signal),
		json(`${AIR_API}?${airParams(point[0])}`, signal).catch(() => null),
		json(`${MARINE_URL}?${marineParams(point)}`, signal).catch(() => null)
	]);
	const weather = parsePlace(forecast, p.name, null);
	if (!Number.isFinite(weather.current.temp)) throw new Error('sin datos de tiempo');
	// El modelo marino busca la celda de mar más cercana: si queda lejos, el sitio es de interior.
	const sea = marine && nearSea(marine, p) ? parseSea(marine, p.name, '') : null;
	weather.sea = sea?.now.water ?? null;

	let air: AirData | null = null;
	try {
		air = airRaw ? parseAir(airRaw, p.name) : null;
	} catch {}

	const data: LocalWeather = {
		fetchedAt: new Date().toISOString(),
		tz: typeof forecast.timezone === 'string' ? forecast.timezone : '',
		weather,
		air,
		sea
	};
	writeCache(p, data);
	return data;
}
