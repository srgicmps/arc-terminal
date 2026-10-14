import { describe, expect, it } from 'vitest';
import type { LaunchesData } from '../../src/lib/launches.ts';
import { launches, parseLaunches, toLaunch } from '../sources/launches.ts';
import { mockFetch } from './mock.ts';

// Muestra con la forma de /2.3.0/launches/upcoming/?mode=detailed (recortada a los campos que se usan,
// más algunos que se ignoran, como en la respuesta real).
const sample = {
	count: 312,
	next: 'https://ll.thespacedevs.com/2.3.0/launches/upcoming/?limit=8&mode=detailed&offset=8',
	previous: null,
	results: [
		{
			id: 'b2e3c7a1-0000-4000-8000-000000000002',
			url: 'https://ll.thespacedevs.com/2.3.0/launches/b2e3c7a1-0000-4000-8000-000000000002/',
			name: 'Electron | Kinéis Constellation Mission 6',
			slug: 'electron-kineis-constellation-mission-6',
			status: { id: 2, name: 'To Be Determined', abbrev: 'TBD', description: 'Current date is a no earlier than estimation.' },
			net: '2026-11-03T00:00:00Z',
			net_precision: { id: 7, name: 'Month', abbrev: 'MONTH' },
			window_start: '2026-11-03T00:00:00Z',
			window_end: '2026-11-03T00:00:00Z',
			launch_service_provider: { id: 147, name: 'Rocket Lab', abbrev: 'RL', type: { id: 3, name: 'Commercial' } },
			rocket: { id: 8701, configuration: { id: 26, name: 'Electron', full_name: 'Electron', variant: '' } },
			mission: { id: 7001, name: 'Kinéis Constellation Mission 6', type: 'Communications', orbit: { id: 17, name: 'Low Earth Orbit', abbrev: 'LEO' }, info_urls: [], vid_urls: [] },
			info_urls: [],
			vid_urls: [],
			pad: { id: 168, name: 'Rocket Lab Launch Complex 1A', location: { id: 10, name: 'Rocket Lab Launch Complex, Mahia Peninsula, New Zealand' } },
			webcast_live: false,
			image: { id: 1, name: 'Electron', image_url: 'https://example.org/electron.jpg' }
		},
		{
			id: 'a1d2c3b4-0000-4000-8000-000000000001',
			url: 'https://ll.thespacedevs.com/2.3.0/launches/a1d2c3b4-0000-4000-8000-000000000001/',
			name: 'Falcon 9 Block 5 | Starlink Group 10-5',
			status: { id: 1, name: 'Go for Launch', abbrev: 'Go' },
			net: '2026-10-16T02:30:00Z',
			net_precision: { id: 1, name: 'Minute', abbrev: 'MIN' },
			window_start: '2026-10-16T02:30:00Z',
			window_end: '2026-10-16T06:30:00Z',
			launch_service_provider: { id: 121, name: 'SpaceX', abbrev: 'SpX' },
			rocket: { id: 8700, configuration: { id: 164, name: 'Falcon 9', full_name: 'Falcon 9 Block 5' } },
			mission: { id: 7000, name: 'Starlink Group 10-5', info_urls: [{ priority: 0, url: 'https://example.org/mision' }], vid_urls: [] },
			pad: { id: 80, name: 'Space Launch Complex 40', location: { id: 12, name: 'Cape Canaveral SFS, FL, USA' } },
			vid_urls: [
				{ priority: 10, title: 'Re-stream', url: 'https://example.org/restream' },
				{ priority: 0, title: 'SpaceX', url: 'https://x.com/i/broadcasts/1' }
			],
			info_urls: [{ priority: 0, url: 'https://www.spacex.com/launches/' }]
		},
		{
			// Sin misión ni configuración: se saca todo del nombre. Solo página informativa, en formato 2.2.0.
			id: 'c3c3c3c3-0000-4000-8000-000000000003',
			name: 'Long March 2D | Yaogan 45',
			status: { name: 'To Be Confirmed', abbrev: 'TBC' },
			net: '2026-10-20T03:10:00Z',
			net_precision: null,
			window_end: null,
			launch_service_provider: { name: 'China Aerospace Science and Technology Corporation' },
			rocket: null,
			mission: null,
			pad: { name: 'Launch Complex 9401 (SLS-2)', location: { name: 'Jiuquan Satellite Launch Center, People\'s Republic of China' } },
			infoURLs: [{ url: 'https://example.org/yaogan' }]
		},
		// Sin NET: se descarta.
		{ id: 'd4d4d4d4-0000-4000-8000-000000000004', name: 'Starship | Flight 13', net: null }
	]
};

const OLD: LaunchesData = {
	asOf: '2026-10-14T06:00:00.000Z',
	launches: parseLaunches(sample)
};

describe('launches', () => {
	it('normaliza la respuesta, ordena por NET y descarta los que no tienen fecha', () => {
		const list = parseLaunches(sample);
		expect(list.map((l) => l.mission)).toEqual(['Starlink Group 10-5', 'Yaogan 45', 'Kinéis Constellation Mission 6']);
		expect(list[0]).toEqual({
			id: 'a1d2c3b4-0000-4000-8000-000000000001',
			mission: 'Starlink Group 10-5',
			rocket: 'Falcon 9',
			provider: 'SpaceX',
			pad: 'Space Launch Complex 40',
			location: 'Cape Canaveral SFS, FL, USA',
			net: '2026-10-16T02:30:00.000Z',
			precise: true,
			windowStart: '2026-10-16T02:30:00.000Z',
			windowEnd: '2026-10-16T06:30:00.000Z',
			status: 'Go',
			statusName: 'Go for Launch',
			// El webcast de más prioridad, antes que la página informativa.
			url: 'https://x.com/i/broadcasts/1',
			webcast: true
		});
		expect(list[1]).toMatchObject({ rocket: 'Long March 2D', status: 'TBC', precise: true, url: 'https://example.org/yaogan', webcast: false });
		// Fecha de «este mes»: no se enseña la hora.
		expect(list[2]).toMatchObject({ precise: false, url: null, status: 'TBD' });
	});

	it('sin enlaces del lanzamiento, usa los de la misión', () => {
		const l = toLaunch({
			id: 'x',
			name: 'Falcon 9 | Crew-13',
			net: '2026-11-01T10:00:00Z',
			vid_urls: [],
			info_urls: [],
			mission: { name: 'Crew-13', vid_urls: [], info_urls: [{ priority: 0, url: 'https://example.org/crew-13' }] }
		});
		expect(l).toMatchObject({ url: 'https://example.org/crew-13', webcast: false });
	});

	it('hace una sola petición y guarda cuándo se consultó', async () => {
		const fetch = mockFetch((url) => (url.includes('/2.3.0/launches/upcoming/') ? sample : undefined));
		const data = await launches.fetch(undefined);
		expect(fetch).toHaveBeenCalledTimes(1);
		expect(data.launches).toHaveLength(3);
		expect(data.limited).toBeUndefined();
		expect(Date.parse(data.asOf)).toBeGreaterThan(Date.parse(OLD.asOf));
	});

	it('con un 429 no reintenta y reutiliza la copia anterior, marcada', async () => {
		const fetch = mockFetch(() => new Response('Request was throttled.', { status: 429 }));
		const data = await launches.fetch(OLD);
		expect(fetch).toHaveBeenCalledTimes(1);
		expect(data.launches).toEqual(OLD.launches);
		// La fecha de los datos sigue siendo la de la consulta buena.
		expect(data.asOf).toBe(OLD.asOf);
		expect(data.limited).toBeTypeOf('string');
	});

	it('con un 429 y sin copia anterior, falla (update.ts lo marca como error)', async () => {
		mockFetch(() => new Response('', { status: 429 }));
		await expect(launches.fetch(undefined)).rejects.toThrow('HTTP 429');
	});

	it('otros fallos se propagan para que update.ts use la copia publicada (estado «stale»)', async () => {
		const fetch = mockFetch(() => new Response('', { status: 503 }));
		await expect(launches.fetch(OLD)).rejects.toThrow('HTTP 503');
		expect(fetch).toHaveBeenCalledTimes(1);
	});
});
