import { afterEach, describe, expect, it, vi } from 'vitest';
import { alertQuotes, fetchQuotes, parseTickers } from '../sources/alert-quotes.ts';
import { mockFetch } from './mock.ts';

afterEach(() => {
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
});

const quote = { c: 101.5, d: 1.5, dp: 1.5, h: 102, l: 99, o: 100, pc: 100, t: 1_791_986_400 };

describe('alert-quotes', () => {
	it('lee la lista del secreto: mayúsculas, sin huecos, sin repetidos ni basura', () => {
		expect(parseTickers(' nvda, AIR.PA ,,rhm.de NVDA saab-b.st <script>')).toEqual(['NVDA', 'AIR.PA', 'RHM.DE', 'SAAB-B.ST']);
		expect(parseTickers(undefined)).toEqual([]);
	});

	it('pide cada símbolo con la clave en la cabecera y salta los que vienen a 0', async () => {
		const fetch = mockFetch((url) => (url.includes('NVDA') ? quote : { c: 0, d: null, dp: null, pc: 0, t: 0 }));
		const { quotes, failed } = await fetchQuotes(['NVDA', 'XXXX'], 'k', 0);
		expect(quotes).toEqual([
			{ symbol: 'NVDA', price: 101.5, change: 1.5, changePct: 1.5, prevClose: 100, time: '2026-10-14T14:00:00.000Z' }
		]);
		expect(failed).toBe(1);
		const [url, init] = fetch.mock.calls[0];
		expect(String(url)).not.toContain('token');
		expect((init?.headers as Record<string, string>)['X-Finnhub-Token']).toBe('k');
	});

	it('sin la clave de Finnhub falla, y sin ninguna cotización también', async () => {
		vi.stubEnv('ALERT_TICKERS', 'NVDA');
		vi.stubEnv('FINNHUB_API_KEY', '');
		await expect(alertQuotes.fetch(undefined)).rejects.toThrow('FINNHUB_API_KEY');
		vi.stubEnv('FINNHUB_API_KEY', 'k');
		mockFetch(() => ({ c: 0 }));
		await expect(alertQuotes.fetch(undefined)).rejects.toThrow('ningún símbolo');
	});

	it('no sale sin ALERT_TICKERS (requires)', () => {
		expect(alertQuotes.requires).toBe('ALERT_TICKERS');
	});
});
