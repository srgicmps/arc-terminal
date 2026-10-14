import { afterEach, describe, expect, it, vi } from 'vitest';
import { ioda, iodaUrl, parseIoda } from '../sources/ioda.ts';
import { mockFetch } from './mock.ts';

const T = 1_791_900_000; // 2026-10-13T… en segundos
const alert = (code: string, datasource: string, dt: number, level: string, value = 10, historyValue = 100) => ({
	entity: { code, name: code === 'IR' ? 'Iran' : code === 'SY' ? 'Syria' : 'Spain', type: 'country' },
	datasource,
	time: T + dt,
	level,
	condition: '< 0.8',
	value,
	historyValue
});

afterEach(() => vi.unstubAllGlobals());

describe('ioda', () => {
	it('pide las alertas de países de las últimas 12 horas', () => {
		const url = iodaUrl(T * 1000);
		expect(url).toContain(`from=${T - 12 * 3600}&until=${T}`);
		expect(url).toContain('entityType=country');
	});

	it('saca los países con alguna señal sin recuperar; los recuperados no salen', () => {
		const out = parseIoda({
			data: [
				alert('IR', 'bgp', 0, 'warning', 60),
				alert('IR', 'bgp', 600, 'critical', 20),
				alert('IR', 'ping-slash24', 300, 'critical', 5),
				// Siria cayó y se recuperó: fuera.
				alert('SY', 'bgp', 0, 'critical'),
				alert('SY', 'bgp', 900, 'normal', 100),
				// España: una racha vieja ya cerrada y una nueva abierta.
				alert('ES', 'merit-nt', 0, 'critical'),
				alert('ES', 'merit-nt', 100, 'normal'),
				alert('ES', 'merit-nt', 200, 'warning', 70),
				// Una bajada del 3 % en BGP: ruido, no sale.
				alert('PW', 'bgp', 0, 'critical', 57, 59),
				{ entity: {}, datasource: 'bgp', time: T, level: 'critical' }
			]
		});
		expect(out).toEqual([
			{
				code: 'IR',
				name: 'Iran',
				level: 'critical',
				signals: ['bgp', 'ping-slash24'],
				since: new Date(T * 1000).toISOString(),
				last: new Date((T + 600) * 1000).toISOString(),
				drop: 95,
				url: 'https://ioda.inetintel.cc.gatech.edu/country/IR'
			},
			{
				code: 'ES',
				name: 'Spain',
				level: 'warning',
				signals: ['merit-nt'],
				since: new Date((T + 200) * 1000).toISOString(),
				last: new Date((T + 200) * 1000).toISOString(),
				drop: 30,
				url: 'https://ioda.inetintel.cc.gatech.edu/country/ES'
			}
		]);
	});

	it('sin alertas, lista vacía; sin «data», falla', async () => {
		mockFetch(() => ({ data: [] }));
		await expect(ioda.fetch(undefined)).resolves.toEqual([]);
		mockFetch(() => ({ error: 'x' }));
		await expect(ioda.fetch(undefined)).rejects.toThrow('IODA');
	});
});
