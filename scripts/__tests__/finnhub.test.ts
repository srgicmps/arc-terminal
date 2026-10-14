// Finnhub: calendario de resultados, noticias y cotizaciones. La clave va en la cabecera X-Finnhub-Token.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { finnhub } from '../sources/finnhub.ts';
import { mockFetch } from './mock.ts';

const KEY = 'clave-finnhub-123';

beforeEach(() => {
	vi.useFakeTimers({ toFake: ['Date'] });
	vi.setSystemTime(new Date('2026-10-14T10:00:00Z'));
	vi.stubEnv('FINNHUB_API_KEY', KEY);
});
afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllEnvs();
});

const t = (iso: string) => Date.parse(iso) / 1000;

/** Respuestas con la forma de /calendar/earnings, /news y /quote. */
function api(over: { earnings?: object; news?: object; quote?: (symbol: string) => object } = {}) {
	return (url: string) => {
		const u = new URL(url);
		if (u.pathname.endsWith('/calendar/earnings')) return over.earnings;
		if (u.pathname.endsWith('/news')) return over.news;
		if (u.pathname.endsWith('/quote')) return over.quote?.(u.searchParams.get('symbol')!);
		return undefined;
	};
}

const zero = { c: 0, d: null, dp: null, h: 0, l: 0, o: 0, pc: 0, t: 0 };

describe('finnhub', () => {
	it('lee resultados, noticias y cotizaciones y manda la clave en la cabecera', async () => {
		const fetch = mockFetch(
			api({
				earnings: {
					earningsCalendar: [
						{ date: '2026-10-22', symbol: 'TSLA', hour: 'amc', quarter: 3, year: 2026, epsEstimate: 0.55, epsActual: null, revenueEstimate: 26e9, revenueActual: null },
						// Pequeña y fuera de la lista: se descarta.
						{ date: '2026-10-15', symbol: 'TINY', hour: 'bmo', quarter: 3, year: 2026, epsEstimate: 0.1, epsActual: null, revenueEstimate: 5e7, revenueActual: null },
						// Fuera de la lista, pero factura más de 2.000 M$: se queda.
						{ date: '2026-10-15', symbol: 'BIGCO', hour: 'bmo', quarter: 3, year: 2026, epsEstimate: 1.2, epsActual: 1.3, revenueEstimate: 3e9, revenueActual: 3.1e9 }
					]
				},
				news: [
					{ category: 'top news', datetime: t('2026-10-14T08:00:00Z'), headline: 'Stocks &amp; bonds rally', id: 1, image: '', related: '', source: 'CNBC', summary: '<p>Resumen</p>', url: 'https://cnbc.com/a' },
					{ category: 'top news', datetime: t('2026-10-14T09:00:00Z'), headline: 'Fed holds', id: 2, image: '', related: '', source: 'Reuters', summary: '', url: 'https://reuters.com/b' }
				],
				quote: (s) => (s === 'NVDA' ? { c: 190.5, d: 2.5, dp: 1.33, h: 191, l: 187, o: 188, pc: 188, t: t('2026-10-13T20:00:00Z') } : zero)
			})
		);
		const data = await finnhub.fetch(undefined);

		expect(data.earnings.map((e) => e.symbol)).toEqual(['BIGCO', 'TSLA']);
		expect(data.earnings[1]).toEqual({
			date: '2026-10-22',
			symbol: 'TSLA',
			hour: 'amc',
			quarter: 3,
			year: 2026,
			epsEstimate: 0.55,
			epsActual: null,
			revenueEstimate: 26e9,
			revenueActual: null
		});
		expect(data.news.map((n) => n.title)).toEqual(['Fed holds', 'Stocks & bonds rally']);
		expect(data.news[1]).toEqual({ title: 'Stocks & bonds rally', url: 'https://cnbc.com/a', source: 'CNBC', time: '2026-10-14T08:00:00.000Z', summary: 'Resumen' });
		// Las cotizaciones a 0 (símbolo desconocido) se descartan.
		expect(data.quotes).toEqual([{ symbol: 'NVDA', price: 190.5, change: 2.5, changePct: 1.33, prevClose: 188, time: '2026-10-13T20:00:00.000Z' }]);

		// Calendario de 3 días atrás a 14 días adelante (día de Madrid).
		const calendar = new URL(String(fetch.mock.calls.find((c) => String(c[0]).includes('/calendar/'))![0]));
		expect(calendar.searchParams.get('from')).toBe('2026-10-11');
		expect(calendar.searchParams.get('to')).toBe('2026-10-28');

		// La clave va en la cabecera de todas las llamadas y nunca en la URL.
		expect(fetch.mock.calls.length).toBeGreaterThan(2);
		for (const [url, init] of fetch.mock.calls) {
			expect((init?.headers as Record<string, string>)['X-Finnhub-Token']).toBe(KEY);
			expect(String(url)).not.toContain(KEY);
		}
	});

	it('aguanta campos ausentes o nulos y descarta lo que no sirve', async () => {
		mockFetch(
			api({
				earnings: {
					earningsCalendar: [
						{ date: '2026-10-20', symbol: 'NVDA' }, // sin hora ni cifras
						{ date: '', symbol: 'AAPL' }, // sin fecha: fuera
						{ date: '2026-10-21', symbol: null } // sin símbolo: fuera
					]
				},
				news: [
					{ headline: 'Sin fuente ni hora', url: 'https://x.com/1', source: '', datetime: 0 },
					{ headline: 'Sin enlace', url: '', source: 'X', datetime: t('2026-10-14T08:00:00Z') },
					{ headline: null, url: 'https://x.com/2', source: 'X', datetime: t('2026-10-14T08:00:00Z') }
				],
				quote: (s) => (s === 'SPY' ? { c: 600, d: null, dp: null, pc: null, t: 0 } : Response.json(null))
			})
		);
		const data = await finnhub.fetch(undefined);
		expect(data.earnings).toEqual([
			{ date: '2026-10-20', symbol: 'NVDA', hour: '', quarter: null, year: null, epsEstimate: null, epsActual: null, revenueEstimate: null, revenueActual: null }
		]);
		expect(data.news).toEqual([{ title: 'Sin fuente ni hora', url: 'https://x.com/1', source: 'Finnhub', time: null, summary: '' }]);
		expect(data.quotes).toEqual([{ symbol: 'SPY', price: 600, change: null, changePct: null, prevClose: null, time: null }]);
	});

	it('si una parte falla, conserva la de la vez anterior', async () => {
		vi.spyOn(console, 'log').mockImplementation(() => {});
		mockFetch(
			api({
				earnings: new Response('', { status: 403 }),
				news: [{ headline: 'Nueva', url: 'https://x.com/n', source: 'X', datetime: t('2026-10-14T08:00:00Z') }],
				quote: () => zero
			})
		);
		const previous = {
			earnings: [{ date: '2026-10-20', symbol: 'NVDA', hour: '', quarter: 3, year: 2026, epsEstimate: null, epsActual: null, revenueEstimate: null, revenueActual: null }],
			news: [],
			quotes: [{ symbol: 'SPY', price: 1, change: null, changePct: null, prevClose: null, time: null }]
		};
		const data = await finnhub.fetch(previous);
		expect(data.earnings).toBe(previous.earnings);
		expect(data.news.map((n) => n.title)).toEqual(['Nueva']);
		// Las cotizaciones no fallan (son todas 0): se quedan vacías, no se reutilizan.
		expect(data.quotes).toEqual([]);
	});

	it('lanza un error si no llega nada', async () => {
		vi.spyOn(console, 'log').mockImplementation(() => {});
		mockFetch(api({ earnings: {}, news: [], quote: () => zero }));
		await expect(finnhub.fetch(undefined)).rejects.toThrow('Finnhub no ha devuelto datos');
	});

	it('si todo falla, el error dice por qué y no lleva la clave', async () => {
		vi.spyOn(console, 'log').mockImplementation(() => {});
		mockFetch(() => new Response('{"error":"Invalid API key"}', { status: 401 }));
		const error = await finnhub.fetch(undefined).catch((e: Error) => e);
		expect((error as Error).message).toMatch(/^Finnhub no ha devuelto datos: HTTP 401 en https:\/\/finnhub\.io/);
		expect((error as Error).message).not.toContain(KEY);
	});
});
