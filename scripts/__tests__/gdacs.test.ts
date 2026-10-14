import { afterEach, describe, expect, it, vi } from 'vitest';
import { gdacs, gdacsDate, gdacsUrl, parseGdacs } from '../sources/gdacs.ts';
import { mockFetch } from './mock.ts';

const NOW = Date.parse('2026-10-14T12:00:00Z');

const feature = (props: Record<string, unknown>, coords = [125.5, 12.1]) => ({
	type: 'Feature',
	geometry: { type: 'Point', coordinates: coords },
	properties: props
});

const body = {
	type: 'FeatureCollection',
	features: [
		feature({
			eventtype: 'TC',
			eventid: 1001234,
			name: 'Tropical Cyclone KOINU-26',
			alertlevel: 'Orange',
			alertscore: 2,
			iscurrent: 'true',
			country: 'Philippines',
			fromdate: '2026-10-10T00:00:00',
			todate: '2026-10-14T06:00:00',
			datemodified: '2026-10-14T06:30:00',
			severitydata: { severitytext: 'Tropical Storm (maximum wind speed of 111 km/h)' },
			url: { report: 'https://www.gdacs.org/report.aspx?eventid=1001234&eventtype=TC' }
		}),
		// El mismo ciclón, episodio anterior: se descarta.
		feature({
			eventtype: 'TC',
			eventid: 1001234,
			name: 'Tropical Cyclone KOINU-26',
			alertlevel: 'Orange',
			iscurrent: 'true',
			todate: '2026-10-12T06:00:00',
			datemodified: '2026-10-12T06:30:00'
		}),
		feature(
			{
				eventtype: 'EQ',
				eventid: 1500001,
				name: 'Earthquake in Japan',
				alertlevel: 'Red',
				alertscore: 3,
				iscurrent: 'false',
				affectedcountries: [{ countryname: 'Japan' }],
				fromdate: '2026-10-11T03:00:00Z',
				todate: '2026-10-11T03:00:00Z',
				severitydata: { severitytext: 'Magnitude 7.4M, Depth:10km' },
				url: { report: 'no reportlink found' }
			},
			[142, 38]
		),
		// Verde: no interesa. Naranja de hace un mes y ya cerrada: tampoco. Tipo desconocido: fuera.
		feature({ eventtype: 'FL', eventid: 9, alertlevel: 'Green', iscurrent: 'true', todate: '2026-10-14' }),
		feature({ eventtype: 'DR', eventid: 8, alertlevel: 'Orange', iscurrent: 'false', todate: '2026-09-01' }),
		feature({ eventtype: 'XX', eventid: 7, alertlevel: 'Red', iscurrent: 'true' })
	]
};

afterEach(() => vi.unstubAllGlobals());

describe('gdacs', () => {
	it('lee las fechas de GDACS como UTC', () => {
		expect(gdacsDate('2026-10-10T08:12:00')).toBe('2026-10-10T08:12:00.000Z');
		expect(gdacsDate('2026-10-10T08:12:00Z')).toBe('2026-10-10T08:12:00.000Z');
		expect(gdacsDate('')).toBeNull();
		expect(gdacsDate('basura')).toBeNull();
	});

	it('pide solo naranjas y rojas de los últimos 30 días', () => {
		expect(gdacsUrl(NOW)).toContain('alertlevel=Orange;Red&fromdate=2026-09-14&todate=2026-10-15');
	});

	it('se queda con las naranjas y rojas vigentes o recientes, una por evento y rojas primero', () => {
		expect(parseGdacs(body, NOW)).toEqual([
			{
				id: 'EQ1500001',
				type: 'EQ',
				kind: 'Terremoto',
				level: 'red',
				name: 'Earthquake in Japan',
				country: 'Japan',
				from: '2026-10-11T03:00:00.000Z',
				to: '2026-10-11T03:00:00.000Z',
				updated: '2026-10-11T03:00:00.000Z',
				severity: 'Magnitude 7.4M, Depth:10km',
				score: 3,
				lat: 38,
				lon: 142,
				url: 'https://www.gdacs.org/report.aspx?eventtype=EQ&eventid=1500001'
			},
			{
				id: 'TC1001234',
				type: 'TC',
				kind: 'Ciclón tropical',
				level: 'orange',
				name: 'Tropical Cyclone KOINU-26',
				country: 'Philippines',
				from: '2026-10-10T00:00:00.000Z',
				to: '2026-10-14T06:00:00.000Z',
				updated: '2026-10-14T06:30:00.000Z',
				severity: 'Tropical Storm (maximum wind speed of 111 km/h)',
				score: 2,
				lat: 12.1,
				lon: 125.5,
				url: 'https://www.gdacs.org/report.aspx?eventid=1001234&eventtype=TC'
			}
		]);
	});

	it('sin alertas devuelve una lista vacía, y sin «features» falla', async () => {
		expect(parseGdacs({ features: [] }, NOW)).toEqual([]);
		mockFetch(() => ({ features: [] }));
		await expect(gdacs.fetch(undefined)).resolves.toEqual([]);
		mockFetch(() => ({ error: 'x' }));
		await expect(gdacs.fetch(undefined)).rejects.toThrow('GDACS');
	});
});
