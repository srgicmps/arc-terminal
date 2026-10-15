// EIA: inventarios semanales de petróleo de EE. UU. La clave va en la URL, así que no debe salir en los errores.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EIA_SERIES, eia, parseEia } from '../sources/eia.ts';
import { vsAvg5, weekChange } from '../../src/lib/eia.ts';
import { mockFetch } from './mock.ts';

const KEY = 'clave-eia-123';

beforeEach(() => vi.stubEnv('EIA_API_KEY', KEY));
afterEach(() => {
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
});

const DAY = 86_400_000;
/** Semanas de una serie, del viernes `last` hacia atrás, con valores en miles de barriles. */
const weeks = (series: string, last: string, values: number[]) =>
	values.map((value, i) => ({
		period: new Date(Date.parse(last) - (values.length - 1 - i) * 7 * DAY).toISOString().slice(0, 10),
		series,
		value: String(value),
		units: 'MBBL'
	}));

describe('eia', () => {
	it('necesita la clave, la manda en la URL y pide cada serie por separado', async () => {
		expect(eia.requires).toBe('EIA_API_KEY');
		expect(eia.deadlineMs).toBe(180_000);
		const fetch = mockFetch((u) => {
			const id = new URL(u).searchParams.get('facets[series][]')!;
			return { response: { data: weeks(id, '2026-10-09', [420000, 418500]) } };
		});
		const data = await eia.fetch(undefined);
		expect(data.stocks).toHaveLength(5);
		expect(data.stocks[0].points.at(-1)).toEqual({ t: '2026-10-09', v: 418.5 });
		expect(fetch).toHaveBeenCalledTimes(5);
		const urls = fetch.mock.calls.map((c) => new URL(String(c[0])));
		expect(urls.every((u) => u.searchParams.get('api_key') === KEY)).toBe(true);
		expect(urls.map((u) => u.searchParams.getAll('facets[series][]')).flat()).toEqual(EIA_SERIES.map((s) => s.id));
		expect(JSON.stringify(data)).not.toContain(KEY);
	});

	it('si falla una serie, sigue con las demás', async () => {
		mockFetch((u) => {
			const id = new URL(u).searchParams.get('facets[series][]')!;
			if (id === 'WGTSTUS1') return new Response('no', { status: 403 });
			return { response: { data: weeks(id, '2026-10-09', [420000, 418500]) } };
		});
		const data = await eia.fetch(undefined);
		expect(data.stocks.map((s) => s.id)).toEqual(['WCESTUS1', 'WDISTUS1', 'W_EPC0_SAX_YCUOK_MBBL', 'WCSSTUS1']);
	});

	it('si la API falla, el error no lleva la URL ni la clave', async () => {
		mockFetch(() => new Response('no', { status: 403 }));
		const error = await eia.fetch(undefined).catch((e: Error) => e.message);
		expect(error).toContain('HTTP 403');
		expect(error).not.toContain(KEY);
		expect(error).not.toContain('api.eia.gov');
	});

	it('también limpia el error que da la propia API', async () => {
		mockFetch(() => ({ error: `Invalid api_key ${KEY}`, code: 'API_KEY_INVALID' }));
		const error = await eia.fetch(undefined).catch((e: Error) => e.message);
		expect(error).toContain('Invalid');
		expect(error).not.toContain(KEY);
	});

	it('guarda 53 semanas, en millones, y la media de la misma semana en 5 años', () => {
		// 6 años y una semana de datos: el valor es 400 000 + 1000 × años transcurridos (en semanas de 364 días: 52).
		const values = Array.from({ length: 6 * 52 + 1 }, (_, i) => 400000 + Math.floor(i / 52) * 1000);
		const [stock] = parseEia({ response: { data: [...weeks('WGTSTUS1', '2026-10-09', values), { period: 'x', series: 'WGTSTUS1', value: '1' }] } });
		expect(stock.label).toBe('Gasolina');
		expect(stock.points).toHaveLength(53);
		expect(stock.points.at(-1)!.v).toBe(406);
		// Hace 1…5 años: 405, 404, 403, 402, 401 → 403.
		expect(stock.avg5).toBeCloseTo(403);
		expect(vsAvg5(stock)).toBeCloseTo((3 / 403) * 100);
		expect(weekChange(stock.points)).toBe(1);
	});

	it('sin cinco años de historia no hay media', () => {
		const [stock] = parseEia({ response: { data: weeks('WCSSTUS1', '2026-10-09', [400000, 401000]) } });
		expect(stock.avg5).toBeNull();
		expect(vsAvg5(stock)).toBeNull();
	});
});
