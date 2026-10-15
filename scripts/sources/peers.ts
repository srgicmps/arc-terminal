// Competidores de los grandes valores de EE. UU. (Finnhub /stock/peers, plan gratuito; misma clave que
// finnhub.ts), para RV. Cambian poco: cada valor se refresca una vez por semana y, en cada pasada, como mucho
// PER_RUN valores a una consulta cada 2,5 s, para no sumar mucho al cupo de 60 por minuto que comparten
// finnhub.ts, analysts.ts y perf.ts. Sin clave, la fuente se salta y RV no sale.
import type { PeersData } from '../../src/lib/types.ts';
import { getJson, type Source } from '../lib.ts';
import { PERF_SYMBOLS } from './perf.ts';

const API = 'https://finnhub.io/api/v1';
const ENV = 'FINNHUB_API_KEY';
const STALE_MS = 7 * 24 * 3_600_000;
export const PER_RUN = 10;
const GAP_MS = 2500;
/** Competidores que se guardan por valor (Finnhub da hasta una docena). */
const MAX_PEERS = 10;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Los que toca refrescar: sin datos o con más de una semana, los más viejos primero. */
export function duePeers(codes: string[], previous: PeersData | undefined, now: number, max = PER_RUN): string[] {
	const age = (c: string) => {
		const t = Date.parse(previous?.symbols[c]?.fetchedAt ?? '');
		return Number.isFinite(t) ? now - t : Infinity;
	};
	return codes
		.filter((c) => age(c) >= STALE_MS)
		.sort((a, b) => age(b) - age(a))
		.slice(0, max);
}

/** La lista de Finnhub, sin el propio valor y sin repetidos. */
export function toPeers(code: string, body: unknown): string[] {
	if (!Array.isArray(body)) return [];
	return [...new Set(body.filter((s): s is string => typeof s === 'string' && s !== code).map((s) => s.toUpperCase()))].slice(0, MAX_PEERS);
}

export const peers: Source<PeersData> = {
	name: 'peers',
	label: 'Competidores de valores de EE. UU. (para RV) · Finnhub',
	// Cada pasada mira si hay valores con más de una semana; si no, no llama a nadie.
	maxAgeMinutes: 60,
	requires: ENV,
	// Detrás de finnhub.ts, como perf.ts.
	after: true,
	async fetch(previous) {
		const key = process.env[ENV] ?? '';
		const now = Date.now();
		const symbols: PeersData['symbols'] = { ...previous?.symbols };
		for (const [i, s] of duePeers(PERF_SYMBOLS, previous, now).entries()) {
			if (i) await wait(GAP_MS);
			try {
				const body = await getJson(`${API}/stock/peers?symbol=${encodeURIComponent(s)}`, { headers: { 'X-Finnhub-Token': key } });
				const list = toPeers(s, body);
				if (list.length) symbols[s] = { peers: list, fetchedAt: new Date(now).toISOString() };
			} catch (error) {
				console.log(`  peers · ${s}: ${error instanceof Error ? error.message : error}`);
			}
		}
		// Los valores que ya no están en la lista se quitan.
		for (const s of Object.keys(symbols)) if (!PERF_SYMBOLS.includes(s)) delete symbols[s];
		if (!Object.keys(symbols).length) throw new Error('Finnhub no ha devuelto competidores');
		console.log(`  peers · ${Object.keys(symbols).length} de ${PERF_SYMBOLS.length} valores`);
		return { symbols };
	}
};
