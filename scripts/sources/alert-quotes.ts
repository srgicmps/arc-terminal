// Cotizaciones del lado del servidor para las alertas de valores (scripts/alerts). Los símbolos vienen
// del secreto ALERT_TICKERS (separados por comas, en formato de Finnhub: «NVDA,AIR.PA,RHM.DE»), nunca del
// repo; sin él, la fuente se salta. Precios de Finnhub (/quote) con FINNHUB_API_KEY, en una cabecera.
// Plan gratuito: 60 llamadas por minuto, compartidas con finnhub.ts; aquí van de una en una y espaciadas.
// El registro no nombra los símbolos: solo cuenta cuántos fallan.
import type { Quote } from '../../src/lib/types.ts';
import { getJson, type Source } from '../lib.ts';
import { toQuote } from './finnhub.ts';

const ENV = 'ALERT_TICKERS';
const KEY = 'FINNHUB_API_KEY';
/** Hasta 40 símbolos: con los ~16 de finnhub.ts no se pasa de 60 por minuto. */
const MAX = 40;
/** Pausa entre llamadas, para no ir a ráfagas. */
const GAP_MS = 300;

/** «nvda, AIR.PA ,,rhm.de» → ['NVDA', 'AIR.PA', 'RHM.DE'], sin repetidos. */
export function parseTickers(value: string | undefined): string[] {
	const out = (value ?? '')
		.split(/[,\s]+/)
		.map((t) => t.trim().toUpperCase())
		.filter((t) => /^[A-Z0-9^][A-Z0-9.\-^=:]{0,19}$/.test(t));
	return [...new Set(out)].slice(0, MAX);
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Pide las cotizaciones de una en una, con `gap` ms entre llamadas. Devuelve las buenas y cuántas fallan. */
export async function fetchQuotes(tickers: string[], key: string, gap = GAP_MS): Promise<{ quotes: Quote[]; failed: number }> {
	const quotes: Quote[] = [];
	let failed = 0;
	for (const [i, symbol] of tickers.entries()) {
		if (i) await wait(gap);
		try {
			const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}`;
			const q = toQuote(symbol, await getJson(url, { headers: { 'X-Finnhub-Token': key } }));
			if (q) quotes.push(q);
			else failed++;
		} catch {
			failed++;
		}
	}
	return { quotes, failed };
}

export const alertQuotes: Source<Quote[]> = {
	name: 'alert-quotes',
	label: 'Cotizaciones para los avisos · Finnhub',
	maxAgeMinutes: 15,
	requires: ENV,
	async fetch() {
		const key = process.env[KEY];
		if (!key) throw new Error(`Falta ${KEY}`);
		const tickers = parseTickers(process.env[ENV]);
		if (!tickers.length) throw new Error(`${ENV} no tiene ningún símbolo válido`);
		const { quotes, failed } = await fetchQuotes(tickers, key);
		if (failed) console.log(`  alert-quotes: ${failed} de ${tickers.length} símbolos sin cotización`);
		if (!quotes.length) throw new Error('Finnhub no da cotización para ningún símbolo');
		return quotes;
	}
};
