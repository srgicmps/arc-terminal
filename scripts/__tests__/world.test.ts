import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { crypto, hn, power, quakes, weather } from '../sources/world.ts';
import { mockFetch } from './mock.ts';

beforeEach(() => {
	vi.useFakeTimers({ toFake: ['Date'] });
	vi.setSystemTime(new Date('2026-10-14T10:00:00Z'));
});
afterEach(() => vi.useRealTimers());

describe('quakes (USGS)', () => {
	it('lee el GeoJSON y ordena del más reciente al más antiguo', async () => {
		mockFetch(() => ({
			features: [
				{
					id: 'us1',
					properties: { mag: 5.1, place: '10 km SW of Somewhere', time: Date.parse('2026-10-13T08:00:00Z'), url: 'https://usgs/us1', tsunami: 0, alert: null },
					geometry: { coordinates: [140.1, 35.2, 10] }
				},
				{
					id: 'us2',
					properties: { mag: 6.3, place: 'Fiji region', time: Date.parse('2026-10-14T08:00:00Z'), url: 'https://usgs/us2', tsunami: 1, alert: 'yellow' },
					geometry: { coordinates: [-178.5, -17.9, 550.4] }
				}
			]
		}));
		const data = await quakes.fetch(undefined);
		expect(data.map((q) => q.id)).toEqual(['us2', 'us1']);
		expect(data[0]).toEqual({
			id: 'us2',
			mag: 6.3,
			place: 'Fiji region',
			time: '2026-10-14T08:00:00.000Z',
			url: 'https://usgs/us2',
			tsunami: true,
			alert: 'yellow',
			lon: -178.5,
			lat: -17.9,
			depth: 550.4
		});
	});
});

describe('power (REE)', () => {
	// La API da el precio por hora en €/MWh.
	const day = (date: string, base: number, hours = 24) =>
		Array.from({ length: hours }, (_, h) => ({
			value: base + h,
			datetime: `${date}T${String(h).padStart(2, '0')}:00:00.000+02:00`
		}));

	it('pide hoy y mañana en hora de Madrid y separa PVPC y mayorista', async () => {
		const fetch = mockFetch(() => ({
			included: [
				{ type: 'PVPC', attributes: { title: 'PVPC', values: day('2026-10-14', 100, 2) } },
				{ type: 'Precio mercado spot', attributes: { title: 'Precio mercado spot', values: [{ value: 'n/d', datetime: 'x' }, ...day('2026-10-15', 50, 1)] } }
			]
		}));
		const data = await power.fetch(undefined);
		const url = new URL(String(fetch.mock.calls[0][0]));
		expect(url.searchParams.get('start_date')).toBe('2026-10-14T00:00');
		expect(url.searchParams.get('end_date')).toBe('2026-10-15T23:59');
		expect(data.pvpc).toEqual([
			{ t: '2026-10-14T00:00:00.000+02:00', v: 100 },
			{ t: '2026-10-14T01:00:00.000+02:00', v: 101 }
		]);
		expect(data.spot).toEqual([{ t: '2026-10-15T00:00:00.000+02:00', v: 50 }]);
		// Con solo dos horas no hay día completo: no se añade al historial.
		expect(data.history).toBeUndefined();
	});

	it('añade al historial cada día completo de PVPC, en €/kWh', async () => {
		mockFetch(() => ({
			included: [{ type: 'PVPC', attributes: { title: 'PVPC', values: [...day('2026-10-14', 100), ...day('2026-10-15', 200, 10)] } }]
		}));
		const previous = { pvpc: [], spot: [], history: [{ date: '2026-10-13', avg: 0.1, min: 0.05, max: 0.2 }] };
		const data = await power.fetch(previous);
		expect(data.history).toEqual([
			{ date: '2026-10-13', avg: 0.1, min: 0.05, max: 0.2 },
			{ date: '2026-10-14', avg: 0.1115, min: 0.1, max: 0.123 }
		]);
	});

	it('falla si no hay precios', async () => {
		mockFetch(() => ({ included: [] }));
		await expect(power.fetch(undefined)).rejects.toThrow('sin precios');
	});
});

describe('weather (Open-Meteo)', () => {
	const forecast = (temp: number) => ({
		current: { time: '2026-10-14T12:00', temperature_2m: temp, weather_code: 2, wind_speed_10m: 15, wind_direction_10m: 340, relative_humidity_2m: 60 },
		daily: {
			time: ['2026-10-14', '2026-10-15'],
			weather_code: [2, 61],
			temperature_2m_max: [24, 21],
			temperature_2m_min: [17, 15],
			precipitation_probability_max: [5, null],
			wind_speed_10m_max: [20, 30]
		}
	});

	it('junta la previsión de cada sitio con la temperatura del mar de los que tienen costa', async () => {
		mockFetch((url) => {
			if (url.startsWith('https://api.open-meteo.com/')) return [1, 2, 3, 4, 5].map((n) => forecast(20 + n));
			if (url.startsWith('https://marine-api.open-meteo.com/'))
				return [22.4, 21.9, 23.1].map((t) => ({ current: { sea_surface_temperature: t } }));
			return undefined;
		});
		const { places } = await weather.fetch(undefined);
		expect(places.map((p) => [p.name, p.current.temp, p.sea])).toEqual([
			['Maó', 21, 22.4],
			['Ciutadella', 22, 21.9],
			['Madrid', 23, null],
			['Barcelona', 24, 23.1],
			['Nueva York', 25, null]
		]);
		expect(places[0].current).toEqual({ time: '2026-10-14T12:00', temp: 21, code: 2, wind: 15, windDir: 340, humidity: 60 });
		expect(places[0].daily[1]).toEqual({ date: '2026-10-15', code: 61, max: 21, min: 15, rain: 0, wind: 30 });
	});

	it('sigue funcionando si falla el modelo marino', async () => {
		mockFetch((url) => (url.startsWith('https://api.open-meteo.com/') ? [forecast(18)] : undefined));
		const { places } = await weather.fetch(undefined);
		expect(places[0].current.temp).toBe(18);
		expect(places.every((p) => p.sea === null)).toBe(true);
	});
});

describe('crypto (CoinGecko)', () => {
	it('lee las monedas en dólares y añade el precio en euros si lo hay', async () => {
		mockFetch((url) => {
			if (url.includes('/coins/markets'))
				return [
					{ id: 'bitcoin', symbol: 'btc', name: 'Bitcoin', current_price: 110000, price_change_percentage_24h: -1.25, market_cap: 2.2e12 },
					{ id: 'raro', symbol: 'xyz', name: 'Raro', current_price: 1, price_change_percentage_24h: null, market_cap: null }
				];
			if (url.includes('/simple/price')) return { bitcoin: { eur: 95000 } };
			return undefined;
		});
		const { coins } = await crypto.fetch(undefined);
		expect(coins[0]).toEqual({ id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', usd: 110000, eur: 95000, change24h: -1.25, marketCap: 2.2e12 });
		expect(coins[1].eur).toBeNaN();
		expect(coins[1].change24h).toBeNull();
	});
});

describe('hn (Hacker News)', () => {
	it('ordena por puntos y usa el enlace de HN si la noticia no tiene URL', async () => {
		mockFetch(() => ({
			hits: [
				{ objectID: '1', title: 'Show HN: algo', url: '', points: 10, num_comments: 2, created_at: '2026-10-14T08:00:00Z' },
				{ objectID: '2', title: 'Un artículo', url: 'https://www.example.org/post', points: 300, num_comments: 120, created_at: '2026-10-14T07:00:00Z' }
			]
		}));
		const items = await hn.fetch(undefined);
		expect(items.map((i) => [i.id, i.url, i.domain, i.points])).toEqual([
			['2', 'https://www.example.org/post', 'example.org', 300],
			['1', 'https://news.ycombinator.com/item?id=1', 'news.ycombinator.com', 10]
		]);
	});
});
