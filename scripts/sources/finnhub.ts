// Finnhub: calendario de resultados, salidas a bolsa, noticias de mercado y cotizaciones de EE. UU. https://finnhub.io/docs/api
// Necesita una clave gratuita (FINNHUB_API_KEY, en GitHub Secrets). Sin ella, la fuente se salta.
// Plan gratuito: 60 consultas por minuto; aquí son 3 + una por valor (unas 17) cada media hora.
// La clave va en una cabecera (X-Finnhub-Token), así que nunca aparece en URLs ni en mensajes de error.
import type { Earnings, FinnhubData, Ipo, NewsItem, Quote } from '../../src/lib/types.ts';
import { getJson, madridDay, num, plain, settle, type Source } from '../lib.ts';

const API = 'https://finnhub.io/api/v1';
const ENV = 'FINNHUB_API_KEY';

/** Índices (vía ETF) y grandes valores que merece la pena tener siempre a mano. */
const QUOTES = ['SPY', 'QQQ', 'DIA', 'IWM', 'AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'META', 'TSLA', 'AVGO', 'JPM', 'BRK.B'];

/**
 * El calendario trae miles de empresas. Se guardan las grandes: las de esta lista y las que esperan
 * facturar más de 2.000 M$ en el trimestre (si Finnhub da la previsión).
 */
export const WATCH = new Set([
	...QUOTES,
	'ORCL', 'NFLX', 'AMD', 'INTC', 'CRM', 'ADBE', 'CSCO', 'QCOM', 'TXN', 'IBM', 'NOW', 'PLTR', 'MU', 'ASML', 'TSM', 'SAP',
	'BAC', 'WFC', 'GS', 'MS', 'C', 'BLK', 'V', 'MA', 'AXP', 'PYPL',
	'UNH', 'JNJ', 'LLY', 'PFE', 'MRK', 'ABBV', 'NVO',
	'WMT', 'COST', 'HD', 'PG', 'KO', 'PEP', 'MCD', 'NKE', 'SBUX', 'DIS',
	'XOM', 'CVX', 'BA', 'CAT', 'GE', 'LMT', 'UBER', 'SHOP', 'BABA'
]);
const BIG_REVENUE = 2e9;
const MAX_EARNINGS = 150;

const get = <T>(path: string, key: string) => getJson<T>(`${API}${path}`, { headers: { 'X-Finnhub-Token': key } });

const day = (offset: number) => new Date(Date.parse(`${madridDay()}T12:00:00Z`) + offset * 86_400_000).toISOString().slice(0, 10);

type RawEarnings = {
	earningsCalendar?: {
		date: string;
		symbol: string;
		hour?: string;
		quarter?: number;
		year?: number;
		epsEstimate?: number | null;
		epsActual?: number | null;
		revenueEstimate?: number | null;
		revenueActual?: number | null;
	}[];
};

export function toEarnings(body: RawEarnings): Earnings[] {
	return (body.earningsCalendar ?? [])
		.filter((e) => e.date && e.symbol)
		.filter((e) => WATCH.has(e.symbol) || (num(e.revenueEstimate) ?? 0) >= BIG_REVENUE)
		.map((e) => ({
			date: e.date,
			symbol: e.symbol,
			hour: e.hour ?? '',
			quarter: num(e.quarter),
			year: num(e.year),
			epsEstimate: num(e.epsEstimate),
			epsActual: num(e.epsActual),
			revenueEstimate: num(e.revenueEstimate),
			revenueActual: num(e.revenueActual)
		}))
		.sort((a, b) => a.date.localeCompare(b.date) || (b.revenueEstimate ?? 0) - (a.revenueEstimate ?? 0))
		.slice(0, MAX_EARNINGS);
}

type RawIpos = {
	ipoCalendar?: {
		date?: string;
		symbol?: string | null;
		name?: string;
		exchange?: string | null;
		price?: string | null;
		numberOfShares?: number | null;
		totalSharesValue?: number | null;
		status?: string;
	}[];
};

/** Las colocaciones pequeñas (menos de 50 M$, casi siempre SPAC o microempresas) no se guardan. */
const MIN_IPO_VALUE = 50e6;
const MAX_IPOS = 40;

export function toIpos(body: RawIpos): Ipo[] {
	return (body.ipoCalendar ?? [])
		.filter((i) => i.date && i.name && i.status !== 'withdrawn')
		.map((i) => ({
			date: i.date!,
			symbol: i.symbol ?? '',
			name: plain(i.name, 120),
			exchange: i.exchange ?? '',
			price: (i.price ?? '').trim(),
			shares: num(i.numberOfShares),
			value: num(i.totalSharesValue),
			status: i.status ?? ''
		}))
		.filter((i) => i.value === null || i.value >= MIN_IPO_VALUE)
		.sort((a, b) => a.date.localeCompare(b.date) || (b.value ?? 0) - (a.value ?? 0))
		.slice(0, MAX_IPOS);
}

type RawNews = { headline: string; url: string; source: string; datetime: number; summary?: string }[];

export function toNews(body: RawNews): NewsItem[] {
	return (Array.isArray(body) ? body : [])
		.filter((n) => n.headline && n.url)
		.map((n) => ({
			title: plain(n.headline, 300),
			url: n.url,
			source: n.source || 'Finnhub',
			time: n.datetime ? new Date(n.datetime * 1000).toISOString() : null,
			summary: plain(n.summary, 300)
		}))
		.sort((a, b) => (b.time ?? '').localeCompare(a.time ?? ''))
		.slice(0, 60);
}

type RawQuote = { c: number; d: number | null; dp: number | null; pc: number | null; t: number };

export function toQuote(symbol: string, q: RawQuote): Quote | null {
	// Para un símbolo desconocido, Finnhub responde con todo a 0.
	const price = num(q?.c);
	if (!price) return null;
	return {
		symbol,
		price,
		change: num(q.d),
		changePct: num(q.dp),
		prevClose: num(q.pc),
		time: q.t ? new Date(q.t * 1000).toISOString() : null
	};
}

export const finnhub: Source<FinnhubData> = {
	name: 'finnhub',
	label: 'Resultados, salidas a bolsa, noticias de mercado y cotizaciones · Finnhub',
	maxAgeMinutes: 25,
	requires: ENV,
	async fetch(previous) {
		const key = process.env[ENV] ?? '';
		const [earnings, ipos, news, quotes] = await Promise.allSettled([
			get<RawEarnings>(`/calendar/earnings?from=${day(-3)}&to=${day(14)}`, key).then(toEarnings),
			get<RawIpos>(`/calendar/ipo?from=${day(-7)}&to=${day(30)}`, key).then(toIpos),
			get<RawNews>('/news?category=general', key).then(toNews),
			settle('finnhub', QUOTES, (s) => s, async (s) => toQuote(s, await get<RawQuote>(`/quote?symbol=${encodeURIComponent(s)}`, key)))
		]);
		const parts = [earnings, ipos, news, quotes];
		if (parts.every((p) => p.status === 'rejected' || !p.value.length)) {
			const why = parts.find((p) => p.status === 'rejected')?.reason;
			throw new Error(`Finnhub no ha devuelto datos${why ? `: ${why.message ?? why}` : ''}`);
		}
		// Si una parte falla, se conserva la de la vez anterior.
		const pick = <T>(p: PromiseSettledResult<T[]>, old: T[] | undefined, what: string): T[] => {
			if (p.status === 'fulfilled') return p.value;
			console.log(`  finnhub · ${what}: ${p.reason?.message ?? p.reason}`);
			return old ?? [];
		};
		return {
			earnings: pick(earnings, previous?.earnings, 'resultados'),
			ipos: pick(ipos, previous?.ipos, 'salidas a bolsa'),
			news: pick(news, previous?.news, 'noticias'),
			quotes: pick(quotes, previous?.quotes, 'cotizaciones')
		};
	}
};
