import { describe, expect, it, vi } from 'vitest';
import { parseDisasters, reliefweb } from '../sources/reliefweb.ts';
import { mockFetch } from './mock.ts';

const body = {
	totalCount: 3,
	data: [
		{
			id: '52001',
			fields: {
				name: 'Sudan: Cholera Outbreak - Aug 2026',
				date: { event: '2026-08-02T00:00:00+00:00', created: '2026-08-05T10:00:00+00:00' },
				primary_country: { name: 'Sudan' },
				primary_type: { name: 'Epidemic' },
				glide: 'EP-2026-000123-SDN',
				url_alias: 'https://reliefweb.int/disaster/ep-2026-000123-sdn'
			}
		},
		{
			id: '52100',
			fields: {
				name: 'Philippines: Tropical Cyclone - Oct 2026',
				date: { created: '2026-10-10T06:00:00+00:00' },
				country: [{ name: 'Philippines' }],
				type: [{ name: 'Tropical Cyclone' }]
			}
		},
		{ id: '9', fields: {} }
	]
};

describe('reliefweb', () => {
	it('lee país, tipo, fecha y ficha, de más reciente a más antiguo', () => {
		expect(parseDisasters(body)).toEqual([
			{
				id: '52100',
				name: 'Philippines: Tropical Cyclone - Oct 2026',
				country: 'Philippines',
				type: 'Tropical Cyclone',
				date: '2026-10-10T06:00:00.000Z',
				url: 'https://reliefweb.int/disaster/52100',
				glide: ''
			},
			{
				id: '52001',
				name: 'Sudan: Cholera Outbreak - Aug 2026',
				country: 'Sudan',
				type: 'Epidemic',
				date: '2026-08-02T00:00:00.000Z',
				url: 'https://reliefweb.int/disaster/ep-2026-000123-sdn',
				glide: 'EP-2026-000123-SDN'
			}
		]);
	});

	it('pide solo los activos, con el appname del secreto, y falla si no hay ninguno', async () => {
		expect(reliefweb.requires).toBe('RELIEFWEB_APPNAME');
		vi.stubEnv('RELIEFWEB_APPNAME', 'arc-terminal-xyz');
		const fetch = mockFetch(() => ({ data: [] }));
		await expect(reliefweb.fetch(undefined)).rejects.toThrow('ningún desastre');
		const url = String(fetch.mock.calls[0][0]);
		expect(url).toContain('appname=arc-terminal-xyz&');
		expect(url).toContain('filter[value]=ongoing');
		vi.unstubAllEnvs();
	});
});
