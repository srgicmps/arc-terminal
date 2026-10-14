import { afterEach, describe, expect, it, vi } from 'vitest';
import { ALERT_TICKERS, alertQuotes, fetchQuotes } from '../sources/alert-quotes.ts';
import { mockFetch } from './mock.ts';

afterEach(() => vi.unstubAllGlobals());

const quote = { c: 101.5, d: 1.5, dp: 1.5, h: 102, l: 99, o: 100, pc: 100, t: 1_791_986_400 };

describe('alert-quotes', () => {
	it('la lista: defensa, NVDA y AAPL, sin repetidos', () => {
		expect(ALERT_TICKERS).toContain('NVDA');
		expect(new Set(ALERT_TICKERS).size).toBe(ALERT_TICKERS.length);
	});

	it('pide cada símbolo con la clave en la cabecera y aparta los que vienen a 0 o fallan', async () => {
		const fetch = mockFetch((url) => (url.includes('NVDA') ? quote : url.includes('RHM') ? undefined : { c: 0, d: null, dp: null, pc: 0, t: 0 }));
		const { quotes, failed } = await fetchQuotes(['NVDA', 'AIR.PA', 'RHM.DE'], 'k', 0);
		expect(quotes).toEqual([
			{ symbol: 'NVDA', price: 101.5, change: 1.5, changePct: 1.5, prevClose: 100, time: '2026-10-14T14:00:00.000Z' }
		]);
		expect(failed).toEqual(['AIR.PA', 'RHM.DE']);
		const [url, init] = fetch.mock.calls[0];
		expect(String(url)).not.toContain('token');
		expect((init?.headers as Record<string, string>)['X-Finnhub-Token']).toBe('k');
	});

	it('necesita la clave de Finnhub; sin ninguna cotización, falla', async () => {
		expect(alertQuotes.requires).toBe('FINNHUB_API_KEY');
		mockFetch(() => ({ c: 0 }));
		await expect(alertQuotes.fetch(undefined)).rejects.toThrow('ningún símbolo');
	}, 20_000);
});
