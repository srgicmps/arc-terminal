import { afterEach, describe, expect, it, vi } from 'vitest';
import { gie } from '../sources/gie.ts';
import { mockFetch } from './mock.ts';

afterEach(() => vi.unstubAllEnvs());

// Forma de la API de AGSI+: los números llegan como texto y los días, del más reciente al más antiguo.
const reply = (rows: [string, string][]) => ({
	last_page: 1,
	data: rows.map(([gasDayStart, full]) => ({ name: 'x', gasDayStart, full, gasInStorage: '1.0', trend: '0.1' }))
});

describe('gie', () => {
	it('lee el % de llenado de cada zona con la clave en la cabecera x-key', async () => {
		vi.stubEnv('GIE_API_KEY', 'clave');
		vi.spyOn(console, 'log').mockImplementation(() => {});
		const fetch = mockFetch((url) => {
			if (url.includes('type=eu')) return reply([['2026-10-13', '91.20'], ['2026-10-12', '91.05'], ['x', '1']]);
			if (url.includes('country=es')) return reply([['2026-10-13', '88.5']]);
			return undefined;
		});
		const { series } = await gie.fetch(undefined);
		expect(series.map((s) => s.id)).toEqual(['gas-eu', 'gas-es']);
		expect(series[0]).toMatchObject({
			label: 'Unión Europea',
			unit: '%',
			geo: 'EU',
			source: 'GIE AGSI+',
			points: [
				{ t: '2026-10-12', v: 91.05 },
				{ t: '2026-10-13', v: 91.2 }
			]
		});
		const [, init] = fetch.mock.calls[0];
		expect(new Headers(init?.headers).get('x-key')).toBe('clave');
		expect(gie.requires).toBe('GIE_API_KEY');
	});

	it('falla si no llega ninguna zona', async () => {
		vi.spyOn(console, 'log').mockImplementation(() => {});
		mockFetch(() => undefined);
		await expect(gie.fetch(undefined)).rejects.toThrow('GIE AGSI+ no devuelve datos');
	});
});
