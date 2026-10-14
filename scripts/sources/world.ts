// Fuentes del mundo sin clave: terremotos (USGS), precio de la luz (REE), tiempo (Open-Meteo),
// criptomonedas (CoinGecko) y Hacker News.
import type {
	Coin,
	CryptoData,
	HnItem,
	PowerData,
	PricePoint,
	Quake,
	WeatherData,
	WeatherPlace
} from '../../src/lib/types.ts';
import type { SeaState, SunDay } from '../../src/lib/weather.ts';
import { appendDaily, getJson, list, madridDate, num, plain, type Source } from '../lib.ts';

type Raw = Record<string, any>;

// ---------- USGS: terremotos de magnitud 4,5 o más de la última semana. Dominio público. ----------

export const quakes: Source<Quake[]> = {
	name: 'quakes',
	label: 'Terremotos M4,5+ · Servicio Geológico de EE. UU. (USGS)',
	maxAgeMinutes: 25,
	async fetch() {
		const body = await getJson<{ features: Raw[] }>(
			'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_week.geojson'
		);
		return list(body.features)
			.map((f) => ({
				id: String(f.id),
				mag: Number(f.properties?.mag ?? 0),
				place: plain(f.properties?.place),
				time: new Date(Number(f.properties?.time)).toISOString(),
				url: String(f.properties?.url ?? ''),
				tsunami: Boolean(f.properties?.tsunami),
				alert: f.properties?.alert ?? null,
				lon: Number(f.geometry?.coordinates?.[0]),
				lat: Number(f.geometry?.coordinates?.[1]),
				depth: Number(f.geometry?.coordinates?.[2])
			}))
			.sort((a, b) => b.time.localeCompare(a.time))
			.slice(0, 80);
	}
};

// ---------- Red Eléctrica: precio de la luz PVPC y mercado mayorista, hoy y mañana. ----------
// https://www.ree.es/es/apidatos · Reutilización libre citando la fuente.

function iso(day: string, time: string) {
	return `${day.slice(0, 4)}-${day.slice(4, 6)}-${day.slice(6, 8)}T${time}`;
}

export const power: Source<PowerData> = {
	name: 'power',
	label: 'Precio de la luz (PVPC y mayorista) · Red Eléctrica',
	maxAgeMinutes: 55,
	async fetch(previous) {
		const params = new URLSearchParams({
			start_date: iso(madridDate(0), '00:00'),
			end_date: iso(madridDate(1), '23:59'),
			time_trunc: 'hour'
		});
		const body = await getJson<{ included?: Raw[] }>(
			`https://apidatos.ree.es/es/datos/mercados/precios-mercados-tiempo-real?${params}`
		);
		const pick = (match: RegExp): PricePoint[] => {
			const found = list(body.included).find((s) => match.test(String(s.attributes?.title ?? s.type)));
			return list<Raw>(found?.attributes?.values)
				.map((v) => ({ t: String(v.datetime), v: Number(v.value) }))
				.filter((p) => Number.isFinite(p.v));
		};
		const pvpc = pick(/pvpc/i);
		const spot = pick(/spot|mercado/i);
		if (!pvpc.length && !spot.length) throw new Error('sin precios');

		// Una entrada de historial por cada día completo de PVPC (hoy y, por la noche, mañana).
		let history = previous?.history;
		const byDay = new Map<string, number[]>();
		for (const p of pvpc) byDay.set(p.t.slice(0, 10), [...(byDay.get(p.t.slice(0, 10)) ?? []), p.v / 1000]);
		for (const [date, values] of byDay) {
			if (values.length < 23) continue;
			const r = (n: number) => Math.round(n * 10000) / 10000;
			history = appendDaily(history, {
				date,
				avg: r(values.reduce((a, b) => a + b, 0) / values.length),
				min: r(Math.min(...values)),
				max: r(Math.max(...values))
			});
		}
		return { pvpc, spot, history };
	}
};

// ---------- Open-Meteo: tiempo y temperatura del mar. CC BY 4.0, uso no comercial. ----------

const PLACES = [
	{ name: 'Maó', lat: 39.889, lon: 4.265, sea: true },
	{ name: 'Ciutadella', lat: 40.001, lon: 3.84, sea: true },
	{ name: 'Madrid', lat: 40.417, lon: -3.704, sea: false },
	{ name: 'Barcelona', lat: 41.388, lon: 2.17, sea: true },
	{ name: 'Nueva York', lat: 40.713, lon: -74.006, sea: false }
];

export const weather: Source<WeatherData> = {
	name: 'weather',
	label: 'Tiempo, temperatura del agua y oleaje · Open-Meteo',
	maxAgeMinutes: 55,
	async fetch() {
		const params = new URLSearchParams({
			latitude: PLACES.map((p) => p.lat).join(','),
			longitude: PLACES.map((p) => p.lon).join(','),
			current: 'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m',
			daily:
				'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,' +
				'sunrise,sunset,daylight_duration',
			timezone: 'auto',
			// Un día de atrás para comparar la duración del día con la de ayer; en la tabla no se enseña.
			past_days: '1',
			forecast_days: '7'
		});
		const forecasts = list(await getJson<Raw | Raw[]>(`https://api.open-meteo.com/v1/forecast?${params}`));

		// Modelo marino en una sola petición: temperatura del agua en los sitios con costa y, detrás, el oleaje
		// en las dos costas de Menorca (puntos un poco mar adentro para que el modelo no los tome por tierra).
		const coastal = PLACES.filter((p) => p.sea);
		const points = [...coastal, ...COASTS];
		const sea = await getJson<Raw | Raw[]>(`https://marine-api.open-meteo.com/v1/marine?${marineParams(points)}`)
			.then(list)
			.catch(() => [] as Raw[]);
		const seaFor = (name: string) => {
			const i = coastal.findIndex((p) => p.name === name);
			return i < 0 ? null : num(sea[i]?.current?.sea_surface_temperature);
		};

		const places: WeatherPlace[] = PLACES.map((place, i) => {
			const f = forecasts[i] ?? {};
			const d = f.daily ?? {};
			return {
				name: place.name,
				current: {
					time: String(f.current?.time ?? ''),
					temp: Number(f.current?.temperature_2m),
					code: Number(f.current?.weather_code),
					wind: Number(f.current?.wind_speed_10m),
					windDir: Number(f.current?.wind_direction_10m),
					humidity: Number(f.current?.relative_humidity_2m)
				},
				daily: list<string>(d.time).map((date, j) => ({
					date,
					code: Number(d.weather_code?.[j]),
					max: Number(d.temperature_2m_max?.[j]),
					min: Number(d.temperature_2m_min?.[j]),
					rain: Number(d.precipitation_probability_max?.[j] ?? 0),
					wind: Number(d.wind_speed_10m_max?.[j])
				})).slice(1),
				sea: seaFor(place.name),
				sun: parseSun(d, num(f.utc_offset_seconds) ?? 0)
			};
		});
		if (!places.some((p) => Number.isFinite(p.current.temp))) throw new Error('sin datos de tiempo');
		return { places, coasts: parseCoasts(sea.slice(coastal.length)) };
	}
};

/** «2026-10-14T07:52» en hora local + desfase en segundos → ISO en UTC. */
function localToIso(local: unknown, offset: number): string | null {
	const t = Date.parse(`${String(local ?? '')}Z`);
	return Number.isFinite(t) ? new Date(t - offset * 1000).toISOString() : null;
}

/** Sol de hoy (el segundo día: el primero es ayer, por past_days=1) y diferencia de luz con ayer. */
export function parseSun(d: Raw, offset: number): SunDay | null {
	const sunrise = localToIso(d.sunrise?.[1], offset);
	const sunset = localToIso(d.sunset?.[1], offset);
	const daylight = num(d.daylight_duration?.[1]);
	if (!sunrise || !sunset || daylight === null) return null;
	const yesterday = num(d.daylight_duration?.[0]);
	return { sunrise, sunset, daylight, delta: yesterday === null ? null : daylight - yesterday };
}

// Estado del mar en Menorca: costa norte (tramontana) frente a costa sur.
const COASTS = [
	{ name: 'Costa norte', spot: 'Fornells', lat: 40.09, lon: 4.13 },
	{ name: 'Costa sur', spot: 'Son Bou', lat: 39.87, lon: 4.07 }
];

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

function marineParams(points: { lat: number; lon: number }[]) {
	return new URLSearchParams({
		latitude: points.map((p) => p.lat).join(','),
		longitude: points.map((p) => p.lon).join(','),
		current: MARINE_NOW.join(','),
		daily: MARINE_DAILY.join(','),
		timezone: 'Europe/Madrid',
		forecast_days: '3'
	});
}

/** URL de ejemplo (solo las dos costas) para scripts/probe.txt. */
export const COASTS_URL = `https://marine-api.open-meteo.com/v1/marine?${marineParams(COASTS)}`;

/** Respuestas del modelo marino para las dos costas, en el orden de COASTS. */
export function parseCoasts(raw: Raw[]): SeaState[] {
	return COASTS.flatMap((coast, i) => {
		const c = raw[i]?.current ?? {};
		const d = raw[i]?.daily ?? {};
		const state: SeaState = {
			name: coast.name,
			spot: coast.spot,
			now: {
				wave: num(c.wave_height),
				waveDir: num(c.wave_direction),
				wavePeriod: num(c.wave_period),
				swell: num(c.swell_wave_height),
				swellDir: num(c.swell_wave_direction),
				swellPeriod: num(c.swell_wave_period),
				water: num(c.sea_surface_temperature)
			},
			daily: list<string>(d.time).map((date, j) => ({
				date,
				waveMax: num(d.wave_height_max?.[j]),
				swellMax: num(d.swell_wave_height_max?.[j]),
				dir: num(d.wave_direction_dominant?.[j])
			}))
		};
		// Si el modelo no da oleaje en ese punto (lo toma por tierra), mejor no enseñarlo.
		const empty = state.now.wave === null && !state.daily.some((x) => x.waveMax !== null);
		return empty ? [] : [state];
	});
}

// ---------- CoinGecko: criptomonedas principales. API pública, cita obligatoria. ----------

export const crypto: Source<CryptoData> = {
	name: 'crypto',
	label: 'Criptomonedas · CoinGecko',
	maxAgeMinutes: 25,
	async fetch() {
		const params = new URLSearchParams({
			vs_currency: 'usd',
			order: 'market_cap_desc',
			per_page: '15',
			page: '1',
			price_change_percentage: '24h'
		});
		const [usd, eur] = await Promise.all([
			getJson<Raw[]>(`https://api.coingecko.com/api/v3/coins/markets?${params}`),
			getJson<Record<string, { eur: number }>>(
				'https://api.coingecko.com/api/v3/simple/price?vs_currencies=eur&ids=' +
					'bitcoin,ethereum,tether,binancecoin,solana,ripple,usd-coin,cardano,dogecoin,tron'
			).catch(() => ({}) as Record<string, { eur: number }>)
		]);
		const coins: Coin[] = usd.map((c) => ({
			id: String(c.id),
			symbol: String(c.symbol ?? '').toUpperCase(),
			name: String(c.name ?? ''),
			usd: Number(c.current_price),
			eur: Number(eur[c.id]?.eur ?? NaN),
			change24h: num(c.price_change_percentage_24h),
			marketCap: num(c.market_cap)
		}));
		if (!coins.length) throw new Error('sin monedas');
		return { coins };
	}
};

// ---------- Hacker News: portada, vía la API de Algolia. ----------

export const hn: Source<HnItem[]> = {
	name: 'hn',
	label: 'Portada de Hacker News · Algolia',
	maxAgeMinutes: 25,
	async fetch() {
		const body = await getJson<{ hits: Raw[] }>(
			'https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=40'
		);
		return list(body.hits)
			.map((h) => {
				const url = String(h.url || `https://news.ycombinator.com/item?id=${h.objectID}`);
				let domain = '';
				try {
					domain = new URL(url).hostname.replace(/^www\./, '');
				} catch {}
				return {
					id: String(h.objectID),
					title: plain(h.title),
					url,
					domain,
					points: Number(h.points ?? 0),
					comments: Number(h.num_comments ?? 0),
					time: String(h.created_at ?? '')
				};
			})
			.sort((a, b) => b.points - a.points);
	}
};
