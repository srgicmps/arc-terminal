// Fuentes nuevas de WX: calidad del aire (Open-Meteo/CAMS), avisos (MeteoAlarm), oleaje y sol.
// Las respuestas de ejemplo copian la forma de las reales, recortadas.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseAir } from '../sources/air.ts';
import { parseAlerts } from '../sources/alerts.ts';
import { parseCoasts, parseSun, weather } from '../sources/world.ts';
import { mockFetch } from './mock.ts';

describe('air (Open-Meteo, calidad del aire)', () => {
	// Cuatro días de horas en hora local, como con timezone=Europe/Madrid.
	const times = ['14', '15', '16', '17'].flatMap((d) =>
		Array.from({ length: 24 }, (_, h) => `2026-10-${d}T${String(h).padStart(2, '0')}:00`)
	);
	const raw = {
		latitude: 39.9,
		longitude: 4.25,
		utc_offset_seconds: 7200,
		current: {
			time: '2026-10-14T13:00',
			interval: 3600,
			european_aqi: 34,
			pm2_5: 8.1,
			pm10: 17.3,
			ozone: 92,
			nitrogen_dioxide: 3.4,
			uv_index: 3.85,
			olive_pollen: null,
			grass_pollen: 0.3
		},
		hourly: {
			time: times,
			european_aqi: times.map((_, i) => 20 + (i % 24)),
			uv_index: times.map((_, i) => Math.max(0, 5 - Math.abs((i % 24) - 13))),
			olive_pollen: times.map(() => null),
			grass_pollen: times.map((_, i) => (i < 72 ? i % 3 : null))
		}
	};

	it('lee el dato actual, las próximas horas de 3 en 3 y el máximo de cada día', () => {
		const air = parseAir(raw);
		expect(air.place).toBe('Maó');
		expect(air.now).toMatchObject({ time: '2026-10-14T13:00', aqi: 34, pm25: 8.1, pm10: 17.3, o3: 92, no2: 3.4, uv: 3.85 });
		expect(air.now.pollen.olive).toBeNull();
		expect(air.now.pollen.grass).toBe(0.3);
		expect(air.hours.map((h) => h.time.slice(11, 16))).toEqual([
			'13:00', '16:00', '19:00', '22:00', '01:00', '04:00', '07:00', '10:00'
		]);
		expect(air.days.map((d) => d.date)).toEqual(['2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17']);
		expect(air.days[0]).toMatchObject({ aqi: 43, uv: 5 });
		expect(air.days[0].pollen).toMatchObject({ olive: null, grass: 2 });
		// Sin polen en todo el día → null, no 0.
		expect(air.days[3].pollen.grass).toBeNull();
	});

	it('falla si no llega ningún índice', () => {
		expect(() => parseAir({ current: {}, hourly: {} })).toThrow('sin datos de calidad del aire');
	});
});

describe('alerts (MeteoAlarm, Atom con CAP)', () => {
	const entry = (fields: Record<string, string>, extra = '') =>
		`<entry>${Object.entries(fields)
			.map(([k, v]) => (k === 'title' ? `<title>${v}</title>` : `<cap:${k}>${v}</cap:${k}>`))
			.join('')}${extra}</entry>`;
	const feed = (...entries: string[]) =>
		`<?xml version="1.0" encoding="UTF-8"?><feed xmlns="http://www.w3.org/2005/Atom" ` +
		`xmlns:cap="urn:oasis:names:tc:emergency:cap:1.2"><title>MeteoAlarm Spain</title>${entries.join('')}</feed>`;
	const now = Date.parse('2026-10-14T12:00:00Z');

	const xml = feed(
		entry(
			{
				areaDesc: 'Menorca',
				event: 'Aviso amarillo de tormentas',
				onset: '2026-10-14T10:00:00+00:00',
				expires: '2026-10-14T21:59:59+00:00',
				severity: 'Moderate',
				message_type: 'Alert',
				status: 'Actual',
				identifier: 'A1',
				title: 'Yellow Thunderstorm Warning issued for Spain - Menorca'
			},
			'<link href="https://feeds.meteoalarm.org/api/v1/warnings/feeds-spain/abc"/>'
		),
		entry({
			areaDesc: 'Costa de Menorca',
			event: 'Moderate coastalevent warning',
			onset: '2026-10-15T00:00:00+00:00',
			expires: '2026-10-15T21:59:59+00:00',
			severity: 'Severe',
			status: 'Actual',
			identifier: 'A2',
			title: 'Orange Coastal Event Warning issued for Spain - Costa de Menorca'
		}),
		// Otra isla, uno caducado, uno verde y uno cancelado: ninguno cuenta.
		entry({ areaDesc: 'Mallorca', severity: 'Extreme', event: 'Rain', expires: '2026-10-15T21:59:59+00:00' }),
		entry({ areaDesc: 'Menorca', severity: 'Moderate', event: 'Wind', expires: '2026-10-13T21:59:59+00:00' }),
		entry({ areaDesc: 'Menorca', severity: 'Minor', event: 'Wind', expires: '2026-10-16T21:59:59+00:00' }),
		entry({ areaDesc: 'Menorca', severity: 'Moderate', message_type: 'Cancel', expires: '2026-10-16T21:59:59+00:00' })
	);

	it('se queda con los avisos de Menorca en vigor, del más grave al más leve', () => {
		const { zone, alerts } = parseAlerts(xml, now);
		expect(zone).toBe('Menorca');
		expect(alerts).toEqual([
			{
				id: 'A2',
				level: 'orange',
				hazard: 'Costeros',
				area: 'Costa de Menorca',
				onset: '2026-10-15T00:00:00.000Z',
				expires: '2026-10-15T21:59:59.000Z',
				url: 'https://www.aemet.es/es/eltiempo/prediccion/avisos'
			},
			{
				id: 'A1',
				level: 'yellow',
				hazard: 'Tormentas',
				area: 'Menorca',
				onset: '2026-10-14T10:00:00.000Z',
				expires: '2026-10-14T21:59:59.000Z',
				url: 'https://www.aemet.es/es/eltiempo/prediccion/avisos'
			}
		]);
	});

	it('lee una entrada real del feed (registro de la Action, 14-10-2026, con la zona cambiada a Menorca)', () => {
		const real =
			'<entry> <cap:geocode> <valueName>EMMA_ID</valueName> <value>ES852</value> </cap:geocode> ' +
			'<link title="Costa - Menorca" href="https://meteoalarm.org?geocode=EMMA_ID:ES852" hreflang="en"/> ' +
			'<cap:areaDesc>Costa - Menorca</cap:areaDesc> <cap:event>Moderate coastalevent warning</cap:event> ' +
			'<cap:sent>2026-10-14T09:28:08+00:00</cap:sent> <cap:expires>2026-10-15T12:59:59+00:00</cap:expires> ' +
			'<cap:effective>2026-10-14T09:25:31+00:00</cap:effective> <cap:onset>2026-10-14T22:00:00+00:00</cap:onset> ' +
			'<cap:certainty>Likely</cap:certainty> <cap:severity>Moderate</cap:severity> <cap:urgency>Future</cap:urgency> ' +
			'<cap:scope>Public</cap:scope> <cap:message_type>Update</cap:message_type> <cap:status>Actual</cap:status> ' +
			'<cap:identifier>2.49.0.0.724.0.ES.261014092808.611103COCO151370088</cap:identifier> ' +
			'<link type="application/cap+xml" href="https://feeds.meteoalarm.org/api/v1/warnings/feeds-spain/fdce347e-d6e3-4ae6-b97f-bd0c929ada54"/> ' +
			'<link title="Spain" rel="related" href="https://meteoalarm.org?region=ES" hreflang="en"/> ' +
			'<author> <name>meteoalarm.org</name> <uri>https://meteoalarm.org</uri> </author> ' +
			'<published>2026-10-14T09:28:08Z</published> ' +
			'<id>https://feeds.meteoalarm.org/api/v1/warnings/feeds-spain/fdce347e-d6e3-4ae6-b97f-bd0c929ada54?index_info=1&amp;index_area=0&amp;index_geocode=0</id> ' +
			'<title>Yellow Coastalevent Warning issued for Spain - Costa - Menorca</title> <updated>2026-10-14T09:28:08Z</updated> </entry>';
		expect(parseAlerts(feed(real), now).alerts).toEqual([
			{
				id: '2.49.0.0.724.0.ES.261014092808.611103COCO151370088',
				level: 'yellow',
				hazard: 'Costeros',
				area: 'Costa - Menorca',
				onset: '2026-10-14T22:00:00.000Z',
				expires: '2026-10-15T12:59:59.000Z',
				url: 'https://meteoalarm.org?geocode=EMMA_ID:ES852'
			}
		]);
	});

	it('un feed sin avisos es una lista vacía; algo que no es Atom, un error', () => {
		expect(parseAlerts(feed(), now).alerts).toEqual([]);
		expect(() => parseAlerts('<html>no</html>', now)).toThrow('formato de MeteoAlarm');
	});
});

describe('oleaje y sol (Open-Meteo)', () => {
	const point = (wave: number | null) => ({
		current: {
			time: '2026-10-14T13:00',
			sea_surface_temperature: 22.4,
			wave_height: wave,
			wave_direction: 20,
			wave_period: 6.1,
			swell_wave_height: 1.1,
			swell_wave_direction: 30,
			swell_wave_period: 8.3
		},
		daily: {
			time: ['2026-10-14', '2026-10-15', '2026-10-16'],
			wave_height_max: [wave, wave, null],
			swell_wave_height_max: [1.1, 1.4, 1],
			wave_direction_dominant: [20, 20, 350]
		}
	});

	it('lee las dos costas y descarta la que el modelo toma por tierra', () => {
		const coasts = parseCoasts([point(1.6), point(0.3)]);
		expect(coasts.map((c) => [c.name, c.spot, c.now.wave])).toEqual([
			['Costa norte', 'Fornells', 1.6],
			['Costa sur', 'Son Bou', 0.3]
		]);
		expect(coasts[0].now).toEqual({ wave: 1.6, waveDir: 20, wavePeriod: 6.1, swell: 1.1, swellDir: 30, swellPeriod: 8.3, water: 22.4 });
		expect(coasts[1].daily[2]).toEqual({ date: '2026-10-16', waveMax: null, swellMax: 1, dir: 350 });
		expect(parseCoasts([point(null), point(0.3)]).map((c) => c.spot)).toEqual(['Son Bou']);
		expect(parseCoasts([])).toEqual([]);
	});

	it('pasa la salida y la puesta del sol a UTC y compara la luz con ayer', () => {
		const daily = {
			time: ['2026-10-13', '2026-10-14'],
			sunrise: ['2026-10-13T07:51', '2026-10-14T07:52'],
			sunset: ['2026-10-13T19:05', '2026-10-14T19:03'],
			daylight_duration: [40440.5, 40310.2]
		};
		const sun = parseSun(daily, 7200, 1);
		expect(sun?.sunrise).toBe('2026-10-14T05:52:00.000Z');
		expect(sun?.sunset).toBe('2026-10-14T17:03:00.000Z');
		expect(sun?.delta).toBeCloseTo(-130.3, 5);
		// Sin el día anterior no hay diferencia; sin datos, nada.
		expect(parseSun(daily, 7200, 0)?.delta).toBeNull();
		expect(parseSun({}, 0, 0)).toBeNull();
	});
});

describe('weather (fuente completa)', () => {
	afterEach(() => vi.unstubAllGlobals());

	it('lee los cinco sitios, el agua de los que tienen costa y el oleaje de Menorca', async () => {
		const days = ['2026-10-13', '2026-10-14', '2026-10-15'];
		const forecast = (t: number) => ({
			utc_offset_seconds: 7200,
			current: { time: '2026-10-14T13:00', temperature_2m: t, relative_humidity_2m: 60, weather_code: 1, wind_speed_10m: 10, wind_direction_10m: 0 },
			daily: {
				time: days,
				weather_code: [1, 2, 3],
				temperature_2m_max: [20, 21, 22],
				temperature_2m_min: [12, 13, 14],
				precipitation_probability_max: [0, 10, 20],
				wind_speed_10m_max: [10, 11, 12],
				sunrise: days.map((d) => `${d}T08:00`),
				sunset: days.map((d) => `${d}T19:00`),
				daylight_duration: [40000, 39880, 39760]
			}
		});
		const sea = (water: number, wave: number) => ({
			current: { sea_surface_temperature: water, wave_height: wave },
			daily: { time: days.slice(1), wave_height_max: [wave, wave], swell_wave_height_max: [0, 0], wave_direction_dominant: [0, 0] }
		});
		const fetch = mockFetch((url) =>
			url.includes('marine-api')
				? [sea(22, 0.2), sea(22.5, 0.2), sea(21, 0.3), sea(22, 1.1), sea(22.4, 0.4)]
				: url.includes('api.open-meteo.com/v1/forecast')
					? [forecast(20), forecast(19), forecast(17), forecast(21), forecast(15)]
					: undefined
		);
		const { places, coasts } = await weather.fetch(undefined);
		expect(fetch).toHaveBeenCalledTimes(2);
		expect(places.map((p) => [p.name, p.current.temp, p.sea])).toEqual([
			['Maó', 20, 22],
			['Ciutadella', 19, 22.5],
			['Madrid', 17, null],
			['Barcelona', 21, 21],
			['Nueva York', 15, null]
		]);
		// La tabla empieza hoy (no ayer) y el sol compara con el día anterior.
		expect(places[0].daily.map((d) => d.date)).toEqual(['2026-10-14', '2026-10-15']);
		expect(places[0].sun).toEqual({ sunrise: '2026-10-14T06:00:00.000Z', sunset: '2026-10-14T17:00:00.000Z', daylight: 39880, delta: -120 });
		expect(coasts?.map((c) => [c.name, c.now.wave])).toEqual([
			['Costa norte', 1.1],
			['Costa sur', 0.4]
		]);
	});
});
