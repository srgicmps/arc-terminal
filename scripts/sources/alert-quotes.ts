// Cotizaciones del lado del servidor para las alertas de valores (scripts/alerts): los valores de defensa
// del panel de la web, NVDA y AAPL (decisión D23). Precios de Finnhub (/quote) con FINNHUB_API_KEY, que va
// en una cabecera. Plan gratuito: 60 llamadas por minuto, compartidas con finnhub.ts; aquí van de una en
// una y espaciadas. El plan gratuito solo suele dar valores de EE. UU.: los que vienen vacíos no salen.
import type { Quote } from '../../src/lib/types.ts';
import { getJson, type Source } from '../lib.ts';
import { toQuote } from './finnhub.ts';

/**
 * Símbolos en formato de Finnhub. Solo de EE. UU.: el plan gratuito no da los europeos (Airbus, BAE,
 * Rheinmetall, Leonardo, Thales, Saab e Indra salían vacíos); van aparte, con otra fuente.
 */
export const ALERT_TICKERS = [
	'PLTR', 'LMT', 'RTX', 'NOC', 'GD', 'LHX', 'BA',
	'NVDA', 'AAPL',
	// PRUEBA TEMPORAL (D25, no mezclar): ADR y acciones OTC de los 7 europeos.
	'EADSY', 'EADSF', 'BAESY', 'BAESF', 'RNMBY', 'RNMBF', 'FINMY', 'FINMF', 'THLLY', 'THLEF', 'SAABY', 'SAABF', 'ISMAY', 'ISMAF'
];

const KEY = 'FINNHUB_API_KEY';
/** Pausa entre llamadas, para no ir a ráfagas. */
const GAP_MS = 300;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Pide las cotizaciones de una en una, con `gap` ms entre llamadas. Devuelve las buenas y los símbolos que fallan. */
export async function fetchQuotes(tickers: string[], key: string, gap = GAP_MS): Promise<{ quotes: Quote[]; failed: string[] }> {
	const quotes: Quote[] = [];
	const failed: string[] = [];
	for (const [i, symbol] of tickers.entries()) {
		if (i) await wait(gap);
		try {
			const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}`;
			const q = toQuote(symbol, await getJson(url, { headers: { 'X-Finnhub-Token': key } }));
			if (q) quotes.push(q);
			else failed.push(symbol);
			console.log(`  PROBE-ADR ${symbol}: ${q ? `${q.price} · ${q.time} · ${q.changePct}%` : 'sin dato (todo 0)'}`);
		} catch (e) {
			failed.push(symbol);
			console.log(`  PROBE-ADR ${symbol}: error ${e instanceof Error ? e.message.slice(0, 120) : ''}`);
		}
	}
	return { quotes, failed };
}

export const alertQuotes: Source<Quote[]> = {
	name: 'alert-quotes',
	label: 'Cotizaciones para los avisos · Finnhub',
	maxAgeMinutes: 15,
	requires: KEY,
	async fetch() {
		const { quotes, failed } = await fetchQuotes(ALERT_TICKERS, process.env[KEY] ?? '');
		if (failed.length) console.log(`  alert-quotes: sin cotización ${failed.join(', ')}`);
		if (!quotes.length) throw new Error('Finnhub no da cotización para ningún símbolo');
		return quotes;
	}
};
