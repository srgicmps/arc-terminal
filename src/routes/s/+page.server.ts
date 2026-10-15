import { dataset } from '#lib/data.ts';
import { rvMetrics } from '#lib/rv.ts';
import type { Mention } from '#lib/news.ts';
import { summarize, type FinraData } from '#lib/shortvol.ts';
import { holdersFromTop, issuersFor } from '#lib/holders.ts';
import { TICKERS } from '#lib/tickers.ts';
import type { AnalystsData, FinnhubData, FundsData, PeersData, PerfData, Quote, SecData } from '#lib/types.ts';
import type { PageServerLoad } from './$types';

// Los documentos de la SEC y los titulares de todos los valores (dos archivos pequeños); la vista
// elige los suyos.
export const load: PageServerLoad = async () => {
	const [sec, news, analysts, finra, perf, peers, funds, finnhub, alertQuotes] = await Promise.all([
		dataset<SecData>('sec'),
		dataset<Record<string, Mention[]>>('news-index'),
		// Analistas, resultados y directivos (Finnhub): solo valores de EE. UU., unos pocos KB cada uno.
		dataset<AnalystsData>('analysts'),
		// Volumen en corto (FINRA): el último día y la media de unos mil valores de EE. UU., sin el historial (~30 KB).
		dataset<FinraData>('finra'),
		// RV: cifras de unos 60 valores de EE. UU. y de sus competidores (Finnhub), solo las que compara RV.
		dataset<PerfData>('perf'),
		dataset<PeersData>('peers'),
		// Fondos de FONDOS que tienen cada valor de la barra (HDS): solo los de EE. UU. que salen en el índice.
		dataset<FundsData>('funds'),
		// «Por qué se mueve» (F19): la variación del día de Finnhub. De finnhub.json solo se pasan las cotizaciones.
		dataset<FinnhubData>('finnhub'),
		dataset<Quote[]>('alert-quotes')
	]);
	const rv = perf?.data.metrics && peers && {
		fetchedAt: perf.fetchedAt,
		metrics: rvMetrics(perf.data.metrics, peers.data.metrics),
		peers: Object.fromEntries(Object.entries(peers.data.symbols).map(([k, v]) => [k, v.peers]))
	};
	const issuers = funds ? (funds.data.holders ?? holdersFromTop(funds.data.funds)) : [];
	const holders = Object.fromEntries(
		TICKERS.filter((t) => t.cik)
			.map((t) => [t.code, issuersFor(t.code, issuers).map((e) => ({ cusip: e.cusip, name: e.name, holders: e.holders.map(({ shares: _, ...h }) => h) }))] as const)
			.filter(([, list]) => list.length)
	);
	const fundNames = Object.fromEntries((funds?.data.funds ?? []).map((f) => [f.key, f.name]));
	return {
		sec,
		news,
		analysts,
		finra: finra && { ...finra, data: summarize(finra.data) },
		rv,
		hds: funds && { fetchedAt: funds.fetchedAt, holders, fundNames },
		quotes: [...(finnhub?.data.quotes ?? []), ...(alertQuotes?.data ?? [])]
	};
};
