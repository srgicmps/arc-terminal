// Ficha de valor: recomendaciones de los analistas, sorpresas de resultados, compras y ventas de
// directivos en 90 días y, si el plan lo da, el precio objetivo. Todo de Finnhub (https://finnhub.io/docs/api),
// solo para los valores de EE. UU. de la barra (los que tienen CIK de la SEC).
//
// Necesita la clave gratuita FINNHUB_API_KEY (sin ella, la fuente se salta). El plan gratuito permite
// 60 consultas por minuto y la fuente `finnhub` ya gasta unas 16 en cada pasada, así que aquí se reparte:
// cada valor se refresca una vez al día y, en cada pasada, como mucho PER_RUN valores, a una consulta por
// segundo. Los demás conservan lo de la vez anterior. La clave va en una cabecera (X-Finnhub-Token).
import { TICKERS } from '../../src/lib/tickers.ts';
import type {
	EarningsSurprise,
	AnalystsData,
	AnalystRecs,
	InsiderTrade,
	PriceTarget,
	StockAnalysis
} from '../../src/lib/types.ts';
import { getJson, num, plain, type Source } from '../lib.ts';

const API = 'https://finnhub.io/api/v1';
const ENV = 'FINNHUB_API_KEY';

/** Cada cuánto se refresca un valor. */
const STALE_MS = 24 * 3_600_000;
/** Valores por pasada (unas 4 consultas cada uno). */
export const PER_RUN = 8;
/** Pausa entre consultas: una por segundo, para no pasar de 60 por minuto con las de `finnhub`. */
const PACE_MS = 1_100;
const INSIDER_DAYS = 90;
const MAX_INSIDERS = 8;

/** Los valores de EE. UU. de la barra (con CIK de la SEC), sin los ETF. */
export const US_CODES = TICKERS.filter((t) => t.cik && !/\(ETF\)/.test(t.name)).map((t) => t.code);

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const day = (iso: string) => iso.slice(0, 10);

type RawRecs = {
	period?: string;
	strongBuy?: number;
	buy?: number;
	hold?: number;
	sell?: number;
	strongSell?: number;
}[];

export function toRecs(body: RawRecs): AnalystRecs[] {
	return (Array.isArray(body) ? body : [])
		.filter((r) => r.period)
		.map((r) => ({
			period: String(r.period),
			strongBuy: num(r.strongBuy) ?? 0,
			buy: num(r.buy) ?? 0,
			hold: num(r.hold) ?? 0,
			sell: num(r.sell) ?? 0,
			strongSell: num(r.strongSell) ?? 0
		}))
		.sort((a, b) => b.period.localeCompare(a.period))
		.slice(0, 4);
}

type RawEarnings = {
	period?: string;
	actual?: number | null;
	estimate?: number | null;
	surprisePercent?: number | null;
}[];

export function toSurprises(body: RawEarnings): EarningsSurprise[] {
	return (Array.isArray(body) ? body : [])
		.filter((e) => e.period)
		.map((e) => ({
			period: String(e.period),
			actual: num(e.actual),
			estimate: num(e.estimate),
			surprisePct: num(e.surprisePercent)
		}))
		.sort((a, b) => b.period.localeCompare(a.period))
		.slice(0, 4);
}

type RawInsiders = {
	data?: {
		name?: string;
		change?: number;
		transactionPrice?: number;
		transactionDate?: string;
		transactionCode?: string;
	}[];
};

/** Solo compras y ventas en bolsa (códigos P y S del formulario 4), de los últimos 90 días. */
export function toInsiders(body: RawInsiders, now: number): InsiderTrade[] {
	const from = day(new Date(now - INSIDER_DAYS * 86_400_000).toISOString());
	return (body?.data ?? [])
		.filter(
			(t) => (t.transactionCode === 'P' || t.transactionCode === 'S') && t.transactionDate && t.transactionDate >= from
		)
		.map((t) => ({
			name: plain(t.name, 80),
			change: num(t.change) ?? 0,
			price: num(t.transactionPrice) || null,
			date: String(t.transactionDate),
			code: t.transactionCode as 'P' | 'S'
		}))
		.filter((t) => t.name && t.change)
		.sort((a, b) => b.date.localeCompare(a.date))
		.slice(0, MAX_INSIDERS);
}

type RawTarget = { targetMean?: number; targetHigh?: number; targetLow?: number; lastUpdated?: string };

export function toTarget(body: RawTarget): PriceTarget | undefined {
	const mean = num(body?.targetMean);
	if (!mean) return undefined;
	return { mean, high: num(body.targetHigh), low: num(body.targetLow), updated: body.lastUpdated ?? null };
}

/** Los valores que toca refrescar en esta pasada: los que no están o llevan más de 24 h, los más viejos primero. */
export function due(codes: string[], previous: AnalystsData | undefined, now: number, max = PER_RUN): string[] {
	const age = (c: string) => {
		const t = Date.parse(previous?.[c]?.fetchedAt ?? '');
		return Number.isFinite(t) ? now - t : Infinity;
	};
	return codes
		.filter((c) => age(c) >= STALE_MS)
		.sort((a, b) => age(b) - age(a))
		.slice(0, max);
}

export const analysts: Source<AnalystsData> = {
	name: 'analysts',
	label: 'Ficha de valor: analistas, resultados y directivos · Finnhub',
	// Cada pasada mira si hay valores con más de 24 h; si no, no llama a nadie.
	maxAgeMinutes: 30,
	requires: ENV,
	fetch: (previous) => fetchAnalysts(previous)
};

/** La descarga de verdad, con la pausa y la hora como parámetros para los tests. */
export async function fetchAnalysts(
	previous: AnalystsData | undefined,
	{ pace = PACE_MS, now = Date.now() }: { pace?: number; now?: number } = {}
): Promise<AnalystsData> {
	const key = process.env[ENV] ?? '';
	const get = async <T>(path: string): Promise<T> => {
		const body = await getJson<T>(`${API}${path}`, { headers: { 'X-Finnhub-Token': key } });
		await wait(pace);
		return body;
	};
	// Se conservan solo los valores que siguen en la lista.
	const data: AnalystsData = Object.fromEntries(Object.entries(previous ?? {}).filter(([c]) => US_CODES.includes(c)));
	let targetFree = true;
	let errors = 0;
	for (const code of due(US_CODES, previous, now)) {
		const s = encodeURIComponent(code);
		try {
			const entry: StockAnalysis = {
				fetchedAt: new Date(now).toISOString(),
				recs: toRecs(await get<RawRecs>(`/stock/recommendation?symbol=${s}`)),
				surprises: toSurprises(await get<RawEarnings>(`/stock/earnings?symbol=${s}`)),
				insiders: toInsiders(
					await get<RawInsiders>(
						`/stock/insider-transactions?symbol=${s}&from=${day(new Date(now - INSIDER_DAYS * 86_400_000).toISOString())}`
					),
					now
				)
			};
			// El precio objetivo puede ser de pago: si Finnhub lo niega, no se vuelve a pedir en esta pasada.
			if (targetFree) {
				try {
					const target = toTarget(await get<RawTarget>(`/stock/price-target?symbol=${s}`));
					if (target) entry.target = target;
				} catch (error) {
					if (/HTTP 40[13]/.test(String((error as Error).message))) targetFree = false;
				}
			}
			if (!entry.target && data[code]?.target) entry.target = data[code].target;
			data[code] = entry;
		} catch (error) {
			console.log(`  analysts · ${code}: ${(error as Error).message.replace(/token=[^&]+/g, 'token=***')}`);
			if (++errors >= 3) break;
		}
	}
	if (!Object.keys(data).length) throw new Error('Finnhub no ha devuelto datos de ningún valor');
	return data;
}
