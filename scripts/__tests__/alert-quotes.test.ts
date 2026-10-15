import { afterEach, describe, expect, it, vi } from 'vitest';
import { ALERT_TICKERS, BATCHES, alertQuotes, batchFor, fetchQuotes } from '../sources/alert-quotes.ts';
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

	it('por turnos: cada pasada pide un lote y entre todas cubren la lista, sin pasar de 30 llamadas', () => {
		const slot = 5 * 60_000;
		const lots = Array.from({ length: BATCHES }, (_, i) => batchFor(i * slot));
		expect(lots.flat().sort()).toEqual([...ALERT_TICKERS].sort());
		for (const lot of lots) expect(lot.length).toBeLessThanOrEqual(30);
		expect(batchFor(BATCHES * slot)).toEqual(lots[0]);
	});

	it('guarda la cotización anterior de los del otro lote, y olvida los que ya no se siguen', async () => {
		vi.useFakeTimers({ toFake: ['Date'] });
		vi.setSystemTime(0);
		vi.stubEnv('FINNHUB_API_KEY', 'k');
		const batch = batchFor(0);
		const other = ALERT_TICKERS.find((s) => !batch.includes(s))!;
		mockFetch(() => quote);
		const old = { symbol: other, price: 1, change: 0, changePct: 0, prevClose: 1, time: 'x' };
		const gone = { ...old, symbol: 'ZZZZ' };
		const mine = { ...old, symbol: batch[0] };
		const out = await alertQuotes.fetch([old, gone, mine]);
		expect(out.map((q) => q.symbol).sort()).toEqual([...batch, other].sort());
		expect(out.find((q) => q.symbol === batch[0])!.price).toBe(101.5);
		vi.useRealTimers();
		vi.unstubAllEnvs();
	}, 30_000);
});
