// Rentabilidad de los grandes valores de EE. UU. en varios plazos (5 días, 13 y 52 semanas, en lo que va de
// año…), para la tabla de CMP. Finnhub, /stock/metric (plan gratuito, «basic financials»); misma clave que
// finnhub.ts (FINNHUB_API_KEY). Sin clave, la fuente se salta y la tabla de CMP no sale.
// Límite: 60 consultas por minuto (el proyecto se queda en 40). Corre en la segunda fase (`after`), cuando
// finnhub.ts ya ha terminado, y de una en una cada 2,5 s (24 por minuto). Una vez cada 12 horas: son
// datos de cierre diario.
import type { PerfData } from '../../src/lib/types.ts';
import { TICKERS } from '../../src/lib/tickers.ts';
import { getJson, num, type Source } from '../lib.ts';
import { WATCH } from './finnhub.ts';

const API = 'https://finnhub.io/api/v1';
const ENV = 'FINNHUB_API_KEY';
const GAP_MS = 2500;

/** Los valores de EE. UU. de la barra (los que tienen CIK) y la lista grande de finnhub.ts. */
export const PERF_SYMBOLS = [...new Set([...TICKERS.filter((t) => t.cik).map((t) => t.code), ...WATCH])].filter(
	(s) => !['SPY', 'QQQ', 'DIA', 'IWM'].includes(s)
);

/** Se guardan solo las rentabilidades («…PriceReturnDaily»), en %, con dos decimales. */
export function toReturns(body: { metric?: Record<string, unknown> } | null): Record<string, number> | null {
	const out: Record<string, number> = {};
	for (const [k, v] of Object.entries(body?.metric ?? {})) {
		const n = num(v);
		if (k.endsWith('PriceReturnDaily') && n !== null) out[k.replace(/PriceReturnDaily$/, '')] = Math.round(n * 100) / 100;
	}
	return Object.keys(out).length ? out : null;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const perf: Source<PerfData> = {
	name: 'perf',
	label: 'Rentabilidad de valores de EE. UU. por plazos · Finnhub',
	maxAgeMinutes: 715,
	requires: ENV,
	// Detrás de finnhub.ts, para no sumar sus llamadas en el mismo minuto.
	after: true,
	// 60 valores a 2,5 s cada uno: dos minutos y medio.
	deadlineMs: 200_000,
	async fetch(previous) {
		const key = process.env[ENV] ?? '';
		const symbols: PerfData['symbols'] = {};
		for (const [i, s] of PERF_SYMBOLS.entries()) {
			if (i) await wait(GAP_MS);
			try {
				const body = await getJson(`${API}/stock/metric?symbol=${encodeURIComponent(s)}&metric=all`, {
					headers: { 'X-Finnhub-Token': key }
				});
				const r = toReturns(body);
				if (r) symbols[s] = r;
			} catch (error) {
				console.log(`  perf · ${s}: ${error instanceof Error ? error.message : error}`);
				// Si un valor falla, se conserva el de la vez anterior.
				if (previous?.symbols[s]) symbols[s] = previous.symbols[s];
			}
		}
		const count = Object.keys(symbols).length;
		if (!count) throw new Error('Finnhub no ha devuelto rentabilidades');
		// El resumen de update.ts solo cuenta listas: así se ve en el registro cuántos valores han llegado.
		console.log(`  perf · ${count} de ${PERF_SYMBOLS.length} valores`);
		return { symbols };
	}
};
