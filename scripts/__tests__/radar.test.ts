// Cloudflare Radar: cortes de internet anotados y países más atacados por DDoS. El token va en la cabecera.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseOutages, parseTargets, radar } from '../sources/radar.ts';
import { mockFetch } from './mock.ts';

const TOKEN = 'token-radar-123';

beforeEach(() => vi.stubEnv('CLOUDFLARE_RADAR_TOKEN', TOKEN));
afterEach(() => {
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
});

const annotation = (id: string, start: string, end: string | null, over: object = {}) => ({
	id,
	dataSource: 'ALL',
	eventType: 'OUTAGE',
	startDate: start,
	endDate: end,
	locations: ['IR'],
	locationsDetails: [{ code: 'IR', name: 'Iran' }],
	asnsDetails: [],
	outage: { outageCause: 'GOVERNMENT_DIRECTED', outageType: 'NATIONWIDE' },
	linkedUrl: 'https://x.com/CloudflareRadar/status/1',
	...over
});

const top = (rows: object[]) => ({ success: true, result: { top_0: rows, meta: {} } });

describe('radar', () => {
	it('necesita el token y lo manda en la cabecera, nunca en la URL', async () => {
		expect(radar.requires).toBe('CLOUDFLARE_RADAR_TOKEN');
		const fetch = mockFetch((url) =>
			url.includes('/annotations/outages')
				? { success: true, result: { annotations: [annotation('1', '2026-10-14T08:00:00Z', null)] } }
				: top([{ targetCountryAlpha2: 'US', targetCountryName: 'United States', value: '12.5' }])
		);
		const data = await radar.fetch(undefined);
		expect(data.outages).toHaveLength(1);
		expect(data.l3[0]).toEqual({ code: 'US', name: 'United States', pct: 12.5 });
		for (const [url, init] of fetch.mock.calls) {
			expect(String(url)).not.toContain(TOKEN);
			expect(new Headers(init?.headers).get('Authorization')).toBe(`Bearer ${TOKEN}`);
		}
	});

	it('traduce causa y alcance; los cortes en curso van primero y luego los más recientes', () => {
		const out = parseOutages({
			result: {
				annotations: [
					annotation('a', '2026-10-10T00:00:00Z', '2026-10-11T00:00:00Z', { outage: { outageCause: 'cable_cut', outageType: 'REGIONAL' } }),
					annotation('b', '2026-10-12T00:00:00Z', '2026-10-12T05:00:00Z', {
						locations: ['PK'],
						asnsDetails: [{ asn: '17557', name: 'PTCL' }],
						outage: { outageCause: 'POWER_OUTAGE', outageType: 'NETWORK' }
					}),
					annotation('c', '2026-10-09T00:00:00Z', null),
					{ id: 'sin-fecha', startDate: 'nada' }
				]
			}
		});
		expect(out.map((o) => o.id)).toEqual(['c', 'b', 'a']);
		expect(out[0]).toMatchObject({ codes: ['IR'], cause: 'orden del gobierno', scope: 'nacional', end: null });
		expect(out[1]).toMatchObject({ codes: ['PK'], cause: 'apagón eléctrico', scope: 'un operador', networks: ['PTCL'] });
		expect(out[2]).toMatchObject({ cause: 'corte de cable', scope: 'regional' });
	});

	it('una causa nueva no se pierde y un enlace que no es https no pasa', () => {
		const [o] = parseOutages({
			result: { annotations: [annotation('x', '2026-10-14T00:00:00Z', null, { outage: { outageCause: 'SOLAR_STORM' }, linkedUrl: 'javascript:alert(1)' })] }
		});
		expect(o.cause).toBe('solar storm');
		expect(o.scope).toBe('');
		expect(o.url).toBeNull();
	});

	it('lee el ranking de destinos con los campos de capa 3 o de capa 7, ordenado por %', () => {
		const out = parseTargets(
			top([
				{ targetCountryAlpha2: 'de', targetCountryName: 'Germany', value: '4.1' },
				{ clientCountryAlpha2: 'CN', clientCountryName: 'China', value: 9 },
				{ targetCountryAlpha2: 'XX1', value: '3' },
				{ targetCountryAlpha2: 'FR', value: 'n/a' }
			])
		);
		expect(out).toEqual([
			{ code: 'CN', name: 'China', pct: 9 },
			{ code: 'DE', name: 'Germany', pct: 4.1 }
		]);
	});

	it('si la API responde con error, falla (y update.ts se queda con la copia anterior)', async () => {
		mockFetch(() => ({ success: false, errors: [{ message: 'Invalid token' }], result: null }));
		await expect(radar.fetch(undefined)).rejects.toThrow('Invalid token');
	});
});
