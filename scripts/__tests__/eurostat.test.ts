import { describe, expect, it, vi } from 'vitest';
import { eurostat } from '../sources/eurostat.ts';
import { mockFetch } from './mock.ts';
import type { Series } from '../../src/lib/types.ts';

// JSON-stat con la forma de la API de Eurostat: dimensiones freq × unit × geo × time,
// valores en un objeto disperso { posición plana: valor }.
const geos = ['DE', 'EA20', 'ES', 'EU27_2020', 'XX'];
const times = ['2026-07', '2026-08', '2026-09'];
const stat = {
	id: ['freq', 'unit', 'geo', 'time'],
	size: [1, 1, geos.length, times.length],
	dimension: {
		freq: { category: { index: { M: 0 } } },
		unit: { category: { index: { PC_ACT: 0 } } },
		geo: { category: { index: Object.fromEntries(geos.map((g, i) => [g, i])) } },
		// El índice también puede venir como lista.
		time: { category: { index: times } }
	},
	value: {
		// DE
		'0': 3.5,
		'1': 3.6,
		'2': 3.7,
		// EA20 (sin agosto)
		'3': 6.3,
		'5': 6.2,
		// ES
		'6': 10.5,
		'7': 10.4,
		'8': 10.3,
		// EU27_2020
		'11': 5.9,
		// XX: no se pide
		'12': 1
	}
};

describe('eurostat', () => {
	it('desenreda el JSON-stat en una serie por país', async () => {
		vi.spyOn(console, 'log').mockImplementation(() => {});
		mockFetch((url) => (url.includes('/une_rt_m?') && url.includes('age=TOTAL') ? stat : undefined));
		const { series } = await eurostat.fetch(undefined);
		expect(series.map((s) => s.id)).toEqual(['unemployment-es', 'unemployment-de', 'unemployment-eu', 'unemployment-ea']);
		const byId = Object.fromEntries(series.map((s) => [s.id, s]));
		expect(byId['unemployment-es'].points).toEqual([
			{ t: '2026-07', v: 10.5 },
			{ t: '2026-08', v: 10.4 },
			{ t: '2026-09', v: 10.3 }
		]);
		// La zona euro se guarda como «EA», sea cual sea su código del momento.
		expect(byId['unemployment-ea']).toMatchObject({
			geo: 'EA',
			label: 'Paro',
			source: 'Eurostat',
			points: [
				{ t: '2026-07', v: 6.3 },
				{ t: '2026-09', v: 6.2 }
			]
		});
		expect(byId['unemployment-eu'].points).toEqual([{ t: '2026-09', v: 5.9 }]);
	});

	it('acepta los valores como lista', async () => {
		vi.spyOn(console, 'log').mockImplementation(() => {});
		const list = { ...stat, value: Array.from({ length: 15 }, (_, i) => (i === 6 ? 9.9 : null)) };
		mockFetch((url) => (url.includes('/prc_hicp_minr?') ? list : undefined));
		const { series } = await eurostat.fetch(undefined);
		expect(series).toHaveLength(1);
		expect(series[0]).toMatchObject({ id: 'inflation-es', points: [{ t: '2026-07', v: 9.9 }] });
	});

	it('falla si no llega ninguna serie', async () => {
		vi.spyOn(console, 'log').mockImplementation(() => {});
		mockFetch(() => undefined);
		await expect(eurostat.fetch(undefined)).rejects.toThrow('ninguna serie de Eurostat');
	});
});

describe('eurostat: copia incompleta', () => {
	it('da por vieja la copia a la que le falta una serie (como gdp-yoy al añadirla)', () => {
		const ids = ['unemployment', 'youth-unemployment', 'inflation', 'gdp', 'gdp-yoy', 'debt'];
		const series = (list: string[]) => ({ series: list.map((id) => ({ id: `${id}-es` }) as Series) });
		expect(eurostat.isStale?.(series(ids))).toBe(false);
		// «gdp-yoy-es» no cuenta como «gdp»: si falta el trimestral, también es vieja.
		expect(eurostat.isStale?.(series(ids.filter((i) => i !== 'gdp-yoy')))).toBe(true);
		expect(eurostat.isStale?.(series(ids.filter((i) => i !== 'gdp')))).toBe(true);
	});
});
