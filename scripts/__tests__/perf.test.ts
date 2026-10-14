import { afterEach, describe, expect, it, vi } from 'vitest';
import { perf, PERF_SYMBOLS, toReturns } from '../sources/perf.ts';
import { mockFetch } from './mock.ts';

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllEnvs();
});

describe('perf', () => {
	it('se queda solo con las rentabilidades, sin el sufijo y con dos decimales', () => {
		expect(
			toReturns({ metric: { '52WeekPriceReturnDaily': 41.2345, yearToDatePriceReturnDaily: '12.5', '52WeekHigh': 230, beta: 1.9 } })
		).toEqual({ '52Week': 41.23, yearToDate: 12.5 });
		expect(toReturns({ metric: {} })).toBeNull();
		expect(toReturns(null)).toBeNull();
	});

	it('pide los valores de EE. UU. con la clave en la cabecera y sin los ETF de índices', () => {
		expect(PERF_SYMBOLS).toContain('NVDA');
		expect(PERF_SYMBOLS).toContain('AMD');
		expect(PERF_SYMBOLS).not.toContain('SPY');
	});

	it('va de uno en uno y conserva el dato anterior de un valor que falla', async () => {
		vi.useFakeTimers();
		vi.stubEnv('FINNHUB_API_KEY', 'clave');
		const fetch = mockFetch((url) => {
			if (url.includes('symbol=NVDA&')) return { metric: { '52WeekPriceReturnDaily': 40 } };
			if (url.includes('symbol=AMD&')) return new Response('', { status: 500 });
			return { metric: {} };
		});
		const run = perf.fetch({ symbols: { AMD: { '52Week': 10 } } });
		await vi.runAllTimersAsync();
		const data = await run;
		expect(data.symbols.NVDA).toEqual({ '52Week': 40 });
		expect(data.symbols.AMD).toEqual({ '52Week': 10 });
		expect(new Headers(fetch.mock.calls[0][1]?.headers).get('X-Finnhub-Token')).toBe('clave');
		expect(String(fetch.mock.calls[0][0])).not.toContain('clave');
	});
});
