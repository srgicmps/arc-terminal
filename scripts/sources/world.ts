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
import { getJson, list, madridDate, num, plain, type Source } from '../lib.ts';

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
	async fetch() {
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
		const data = { pvpc: pick(/pvpc/i), spot: pick(/spot|mercado/i) };
		if (!data.pvpc.length && !data.spot.length) throw new Error('sin precios');
		return data;
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
	label: 'Tiempo y temperatura del mar · Open-Meteo',
	maxAgeMinutes: 55,
	async fetch() {
		const params = new URLSearchParams({
			latitude: PLACES.map((p) => p.lat).join(','),
			longitude: PLACES.map((p) => p.lon).join(','),
			current: 'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m',
			daily:
				'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max',
			timezone: 'auto',
			forecast_days: '7'
		});
		const forecasts = list(await getJson<Raw | Raw[]>(`https://api.open-meteo.com/v1/forecast?${params}`));

		// Temperatura del agua (modelo marino), solo para los sitios con costa.
		const coastal = PLACES.filter((p) => p.sea);
		const seaParams = new URLSearchParams({
			latitude: coastal.map((p) => p.lat).join(','),
			longitude: coastal.map((p) => p.lon).join(','),
			current: 'sea_surface_temperature'
		});
		const sea = await getJson<Raw | Raw[]>(`https://marine-api.open-meteo.com/v1/marine?${seaParams}`)
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
				})),
				sea: seaFor(place.name)
			};
		});
		if (!places.some((p) => Number.isFinite(p.current.temp))) throw new Error('sin datos de tiempo');
		return { places };
	}
};

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
