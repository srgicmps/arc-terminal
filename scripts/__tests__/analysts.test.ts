// Ficha de valor con Finnhub: recomendaciones, sorpresas de resultados, directivos y precio objetivo.
// Respuestas con la forma documentada de la API (cifras inventadas para el test).
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	analysts,
	due,
	fetchAnalysts,
	PER_RUN,
	toInsiders,
	toRecs,
	toSurprises,
	toTarget,
	US_CODES
} from '../sources/analysts.ts';
import type { AnalystsData } from '../../src/lib/types.ts';
import { mockFetch } from './mock.ts';

const NOW = Date.parse('2026-10-14T12:00:00Z');
afterEach(() => vi.unstubAllEnvs());

const recs = [
	{ period: '2026-09-01', strongBuy: 20, buy: 30, hold: 8, sell: 1, strongSell: 0, symbol: 'NVDA' },
	{ period: '2026-10-01', strongBuy: 22, buy: 31, hold: 7, sell: 0, strongSell: 0, symbol: 'NVDA' }
];
const earnings = [
	{ period: '2026-07-31', actual: 1.05, estimate: 1.01, surprise: 0.04, surprisePercent: 3.96, symbol: 'NVDA' },
	{ period: '2026-04-30', actual: 0.96, estimate: 0.93, surprise: 0.03, surprisePercent: 3.23, symbol: 'NVDA' }
];
const insiders = {
	symbol: 'NVDA',
	data: [
		{
			name: 'HUANG JEN HSUN',
			share: 1,
			change: -120000,
			transactionPrice: 180.5,
			transactionDate: '2026-10-01',
			transactionCode: 'S'
		},
		{ name: 'DIRECTIVO A', change: 5000, transactionPrice: 170, transactionDate: '2026-09-20', transactionCode: 'P' },
		{ name: 'DIRECTIVO B', change: 300, transactionPrice: 0, transactionDate: '2026-09-25', transactionCode: 'M' },
		{ name: 'ANTIGUA', change: -10, transactionPrice: 100, transactionDate: '2026-05-01', transactionCode: 'S' }
	]
};

describe('conversión de las respuestas', () => {
	it('recomendaciones: la más reciente primero', () => {
		expect(toRecs(recs)[0]).toEqual({ period: '2026-10-01', strongBuy: 22, buy: 31, hold: 7, sell: 0, strongSell: 0 });
		expect(toRecs({} as never)).toEqual([]);
	});

	it('sorpresas de resultados: esperado, real y % de sorpresa', () => {
		expect(toSurprises(earnings)[0]).toEqual({ period: '2026-07-31', actual: 1.05, estimate: 1.01, surprisePct: 3.96 });
	});

	it('directivos: solo compras y ventas en bolsa de los últimos 90 días', () => {
		const out = toInsiders(insiders, NOW);
		expect(out.map((t) => t.code)).toEqual(['S', 'P']);
		expect(out[0]).toMatchObject({ name: 'HUANG JEN HSUN', change: -120000, price: 180.5, date: '2026-10-01' });
	});

	it('directivos: quita las filas repetidas, pero no dos ventas iguales a precios distintos', () => {
		const sale = { name: 'KRESS COLETTE', share: 1, change: -5000, transactionPrice: 181, transactionDate: '2026-10-02', transactionCode: 'S' };
		const out = toInsiders({ symbol: 'NVDA', data: [sale, { ...sale }, { ...sale, transactionPrice: 182 }] }, NOW);
		expect(out.map((t) => t.price)).toEqual([181, 182]);
	});

	it('precio objetivo: nada si no hay media', () => {
		expect(toTarget({ targetMean: 210, targetHigh: 250, targetLow: 150, lastUpdated: '2026-10-10' })).toEqual({
			mean: 210,
			high: 250,
			low: 150,
			updated: '2026-10-10'
		});
		expect(toTarget({})).toBeUndefined();
	});
});

describe('reparto de las consultas', () => {
	it('solo valores de EE. UU. con CIK, sin ETF', () => {
		expect(US_CODES).toContain('NVDA');
		expect(US_CODES.every((c) => !c.includes(':'))).toBe(true);
	});

	it('refresca primero lo que no está o lleva más de 24 h, y como mucho PER_RUN', () => {
		const fresh = new Date(NOW - 3_600_000).toISOString();
		const old = new Date(NOW - 30 * 3_600_000).toISOString();
		const prev = { A: { fetchedAt: fresh }, B: { fetchedAt: old } } as unknown as AnalystsData;
		expect(due(['A', 'B', 'C'], prev, NOW)).toEqual(['C', 'B']);
		expect(
			due(
				Array.from({ length: 30 }, (_, i) => `X${i}`),
				undefined,
				NOW
			)
		).toHaveLength(PER_RUN);
	});
});

describe('fetchAnalysts', () => {
	const route =
		(target: object | undefined) =>
		(url: string): object | undefined => {
			if (url.includes('/stock/recommendation')) return recs;
			if (url.includes('/stock/earnings')) return earnings;
			if (url.includes('/stock/insider-transactions')) return insiders;
			if (url.includes('/stock/price-target')) return target;
			return undefined;
		};

	it('descarga PER_RUN valores, conserva el resto y la clave va en la cabecera, no en la URL', async () => {
		vi.stubEnv('FINNHUB_API_KEY', 'clave-secreta');
		const fetch = mockFetch(route({ targetMean: 200 }));
		const prev = {
			[US_CODES[0]]: { fetchedAt: new Date(NOW).toISOString(), recs: [], surprises: [], insiders: [] }
		} as AnalystsData;
		const data = await fetchAnalysts(prev, { pace: 0, now: NOW });
		expect(Object.keys(data)).toHaveLength(PER_RUN + 1);
		expect(data[US_CODES[1]].recs[0].period).toBe('2026-10-01');
		expect(data[US_CODES[1]].target?.mean).toBe(200);
		for (const [url, init] of fetch.mock.calls) {
			expect(String(url)).not.toContain('clave-secreta');
			expect(new Headers(init?.headers).get('X-Finnhub-Token')).toBe('clave-secreta');
		}
	});

	it('si el precio objetivo es de pago (403), deja de pedirlo en la pasada y sigue con lo demás', async () => {
		vi.stubEnv('FINNHUB_API_KEY', 'k');
		const fetch = mockFetch((url) =>
			url.includes('price-target') ? new Response('', { status: 403 }) : route(undefined)(url)
		);
		const data = await fetchAnalysts(undefined, { pace: 0, now: NOW });
		expect(Object.keys(data)).toHaveLength(PER_RUN);
		expect(fetch.mock.calls.filter(([u]) => String(u).includes('price-target'))).toHaveLength(1);
	});

	it('sin la clave, update.ts la salta (requires)', () => {
		expect(analysts.requires).toBe('FINNHUB_API_KEY');
	});
});
