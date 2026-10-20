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
import type { SeaState } from '../../src/lib/weather.ts';
import {
	FORECAST_URL,
	MARINE_URL,
	forecastParams,
	marineParams,
	parsePlace,
	parseSea,
	parseSun,
	seaTemp
} from '../../src/lib/openmeteo.ts';
import { appendDaily, getJson, inRange, list, madridDate, madridDay, num, pct, plain, share, type Source } from '../lib.ts';
import { quakePlace } from '../../src/lib/quakeplace.ts';

type Raw = Record<string, any>;

// ---------- USGS: terremotos de magnitud 4,5 o más de la última semana. Dominio público. ----------

/**
 * Para validate: al menos 9 de cada 10 terremotos con magnitud (es el feed de M4,5+: un 0 sería un campo
 * renombrado, porque `mag ?? 0`) y coordenadas de verdad.
 */
export function checkQuakes(all: Quake[]): string | null {
	const ok = share(all, (q) => inRange(q.mag, 1, 10) && inRange(q.lat, -90, 90) && inRange(q.lon, -180, 180));
	return ok < 0.9 ? `solo el ${pct(ok)} de los terremotos trae magnitud y coordenadas válidas` : null;
}

export const quakes: Source<Quake[]> = {
	name: 'quakes',
	label: 'Terremotos M4,5+ · Servicio Geológico de EE. UU. (USGS)',
	maxAgeMinutes: 12,
	validate: checkQuakes,
	async fetch() {
		const body = await getJson<{ features: Raw[] }>(
			'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_week.geojson'
		);
		return list(body.features)
			.flatMap((f) => {
				// Sin hora válida no se puede ordenar ni mostrar: se descarta ese terremoto, no la fuente.
				// (Ojo: Number(null) es 0, que sería 1970.)
				const t = f.properties?.time;
				const ms = typeof t === 'number' ? t : NaN;
				if (!Number.isFinite(ms) || Math.abs(ms) > 8.64e15) return [];
				return [
					{
						id: String(f.id),
						mag: Number(f.properties?.mag ?? 0),
						place: quakePlace(plain(f.properties?.place)),
						time: new Date(ms).toISOString(),
						url: String(f.properties?.url ?? ''),
						tsunami: Boolean(f.properties?.tsunami),
						alert: f.properties?.alert ?? null,
						lon: Number(f.geometry?.coordinates?.[0]),
						lat: Number(f.geometry?.coordinates?.[1]),
						depth: Number(f.geometry?.coordinates?.[2])
					}
				];
			})
			.sort((a, b) => b.time.localeCompare(a.time))
			.slice(0, 80);
	}
};

// ---------- Red Eléctrica: precio de la luz PVPC y mercado mayorista, hoy y mañana. ----------
// https://www.ree.es/es/apidatos · Reutilización libre citando la fuente.

function iso(day: string, time: string) {
	return `${day.slice(0, 4)}-${day.slice(4, 6)}-${day.slice(6, 8)}T${time}`;
}

/**
 * Para validate: precios en €/MWh con margen (el PVPC, entre -50 y 2000; el mayorista, entre los topes del
 * mercado, -500 y 4000) y, si hay PVPC, el de hoy entero: al menos 23 horas (el día del cambio de hora tiene
 * 23 o 25). Como en fetch, puede faltar uno de los dos.
 */
export function checkPower({ pvpc, spot }: PowerData): string | null {
	const ranges: [string, PricePoint[], number, number][] = [
		['PVPC', pvpc, -50, 2000],
		['mayorista', spot, -500, 4000]
	];
	for (const [label, points, min, max] of ranges) {
		if (!points.length) continue;
		const ok = share(points, (p) => inRange(p.v, min, max));
		if (ok < 0.9) return `${label}: solo el ${pct(ok)} de los precios entre ${min} y ${max} €/MWh`;
	}
	if (pvpc.length) {
		const hours = new Map<string, number>();
		for (const p of pvpc) {
			const day = String(p.t).slice(0, 10);
			hours.set(day, (hours.get(day) ?? 0) + 1);
		}
		const counts = [...hours.values()];
		if (!counts.some((n) => n >= 23)) return `PVPC sin ningún día entero (${counts.join(', ')} horas)`;
	}
	return null;
}

export const power: Source<PowerData> = {
	name: 'power',
	label: 'Precio de la luz (PVPC y mayorista) · Red Eléctrica',
	maxAgeMinutes: 25,
	validate: checkPower,
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

/** Para validate: al menos 4 de cada 5 sitios con la temperatura de ahora creíble (entre -60 y 60 °C). */
export function checkWeather({ places }: WeatherData): string | null {
	const ok = share(places, (p) => inRange(p.current?.temp, -60, 60));
	return ok < 0.8 ? `solo el ${pct(ok)} de los sitios trae una temperatura entre -60 y 60 °C` : null;
}

export const weather: Source<WeatherData> = {
	name: 'weather',
	label: 'Tiempo, temperatura del agua y oleaje · Open-Meteo',
	maxAgeMinutes: 25,
	validate: checkWeather,
	async fetch() {
		const forecasts = list(await getJson<Raw | Raw[]>(`${FORECAST_URL}?${forecastParams(PLACES)}`));

		// Modelo marino en una sola petición: temperatura del agua en los sitios con costa y, detrás, el oleaje
		// en las dos costas de Menorca (puntos un poco mar adentro para que el modelo no los tome por tierra).
		const coastal = PLACES.filter((p) => p.sea);
		const points = [...coastal, ...COASTS];
		const sea = await getJson<Raw | Raw[]>(`${MARINE_URL}?${marineParams(points, 'Europe/Madrid')}`)
			.then(list)
			.catch(() => [] as Raw[]);
		const seaFor = (name: string) => {
			const i = coastal.findIndex((p) => p.name === name);
			return i < 0 ? null : seaTemp(sea[i]);
		};

		// El lector de cada sitio está en src/lib/openmeteo.ts: lo comparte con el tiempo del sitio elegido.
		const places: WeatherPlace[] = PLACES.map((p, i) => parsePlace(forecasts[i] ?? {}, p.name, seaFor(p.name)));
		if (!places.some((p) => Number.isFinite(p.current.temp))) throw new Error('sin datos de tiempo');
		return { places, coasts: parseCoasts(sea.slice(coastal.length)) };
	}
};

export { parseSun };

// Estado del mar en Menorca: costa norte (tramontana) frente a costa sur.
const COASTS = [
	{ name: 'Costa norte', spot: 'Fornells', lat: 40.09, lon: 4.13 },
	{ name: 'Costa sur', spot: 'Son Bou', lat: 39.87, lon: 4.07 }
];

/** Respuestas del modelo marino para las dos costas, en el orden de COASTS. Open-Meteo mueve cada punto a
 *  la celda de mar más cercana (Fornells cae unos 13 km al norte); si alguna vez no hay oleaje, no se enseña. */
export function parseCoasts(raw: Raw[]): SeaState[] {
	return COASTS.flatMap((coast, i) => parseSea(raw[i], coast.name, coast.spot) ?? []);
}

// ---------- CoinGecko: criptomonedas principales. API pública, cita obligatoria. ----------

export const crypto: Source<CryptoData> = {
	name: 'crypto',
	label: 'Criptomonedas · CoinGecko',
	maxAgeMinutes: 12,
	// Recibe la copia anterior para ir guardando el cierre diario de bitcoin (termómetro de riesgo de WS).
	async fetch(previous) {
		const params = new URLSearchParams({
			vs_currency: 'usd',
			order: 'market_cap_desc',
			per_page: '15',
			page: '1',
			price_change_percentage: '24h,7d'
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
			change7d: num(c.price_change_percentage_7d_in_currency),
			marketCap: num(c.market_cap)
		}));
		if (!coins.length) throw new Error('sin monedas');
		const btc = coins.find((c) => c.id === 'bitcoin');
		const btcHistory =
			btc && Number.isFinite(btc.usd)
				? appendDaily(previous?.btcHistory, { date: madridDay(), usd: btc.usd }, 400)
				: (previous?.btcHistory ?? []);
		return { coins, btcHistory };
	}
};

// ---------- Hacker News: portada, vía la API de Algolia. ----------

export const hn: Source<HnItem[]> = {
	name: 'hn',
	label: 'Portada de Hacker News · Algolia',
	maxAgeMinutes: 12,
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
