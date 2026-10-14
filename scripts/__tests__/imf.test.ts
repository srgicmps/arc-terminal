import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { edition, imf } from '../sources/imf.ts';
import { mockFetch } from './mock.ts';

// Respuestas de ejemplo con la forma documentada de la API DataMapper (cifras inventadas para el test).
const values = (id: string, byArea: Record<string, Record<string, number>>) => ({
	values: { [id]: byArea },
	api: { version: '1', 'output-method': 'json' }
});

const indicators = {
	indicators: {
		NGDP_RPCH: { label: 'Real GDP growth', source: 'World Economic Outlook (October 2026)', dataset: 'WEO' },
		PCPIPCH: { label: 'Inflation rate, average consumer prices', source: 'World Economic Outlook (October 2026)' }
	},
	api: { version: '1', 'output-method': 'json' }
};

describe('imf', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-10-14T10:00:00Z'));
	});
	afterEach(() => vi.useRealTimers());

	it('lee PIB e inflación del año actual y el siguiente, con la edición del WEO', async () => {
		const fetch = mockFetch((url) => {
			if (url.endsWith('/indicators')) return indicators;
			if (url.includes('/NGDP_RPCH/'))
				return values('NGDP_RPCH', {
					USA: { '2026': 1.8, '2027': 2.1 },
					ESP: { '2026': 2.4, '2027': 1.9 },
					WEOWORLD: { '2026': 3.1, '2027': 3.2 }
				});
			if (url.includes('/PCPIPCH/'))
				return values('PCPIPCH', {
					USA: { '2026': 2.9, '2027': 2.3 },
					ESP: { '2026': 2.5, '2027': 2.0 },
					WEOWORLD: { '2026': 4.0, '2027': 3.5 }
				});
		});
		const data = await imf.fetch(undefined);
		expect(data.edition).toBe('octubre de 2026');
		expect(data.years).toEqual([2026, 2027]);
		// El orden es el de la tabla, no el de la respuesta.
		expect(data.rows).toEqual([
			{ code: 'WEOWORLD', name: 'Mundo', gdp: [3.1, 3.2], cpi: [4, 3.5] },
			{ code: 'USA', name: 'EE. UU.', gdp: [1.8, 2.1], cpi: [2.9, 2.3] },
			{ code: 'ESP', name: 'España', gdp: [2.4, 1.9], cpi: [2.5, 2] }
		]);
		const url = String(fetch.mock.calls[0][0]);
		expect(url).toContain('/NGDP_RPCH/WEOWORLD/USA/EURO/');
		expect(url).toContain('?periods=2026,2027');
	});

	it('deja a null los años y los indicadores que faltan, y sigue sin la edición', async () => {
		mockFetch((url) => {
			if (url.endsWith('/indicators')) return undefined; // 404: sin metadatos
			if (url.includes('/NGDP_RPCH/')) return values('NGDP_RPCH', { CHN: { '2026': 4.5 } });
			if (url.includes('/PCPIPCH/')) return values('PCPIPCH', { JPN: { '2027': 1.7 } });
		});
		const data = await imf.fetch(undefined);
		expect(data.edition).toBeNull();
		expect(data.rows).toEqual([
			{ code: 'JPN', name: 'Japón', gdp: [null, null], cpi: [null, 1.7] },
			{ code: 'CHN', name: 'China', gdp: [4.5, null], cpi: [null, null] }
		]);
	});

	it('falla si la respuesta viene vacía', async () => {
		mockFetch((url) => (url.endsWith('/indicators') ? indicators : {}));
		await expect(imf.fetch(undefined)).rejects.toThrow('el FMI no devuelve previsiones');
	});

	it('traduce la edición y no se la inventa', () => {
		expect(edition('World Economic Outlook (April 2027)')).toBe('abril de 2027');
		expect(edition('WEO')).toBeNull();
		expect(edition(undefined)).toBeNull();
	});
});
