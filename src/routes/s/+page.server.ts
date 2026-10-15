import { dataset } from '#lib/data.ts';
import { rvMetrics } from '#lib/rv.ts';
import type { Mention } from '#lib/news.ts';
import { summarize, type FinraData } from '#lib/shortvol.ts';
import type { AnalystsData, PeersData, PerfData, SecData } from '#lib/types.ts';
import type { PageServerLoad } from './$types';

// Los documentos de la SEC y los titulares de todos los valores (dos archivos pequeños); la vista
// elige los suyos.
export const load: PageServerLoad = async () => {
	const [sec, news, analysts, finra, perf, peers] = await Promise.all([
		dataset<SecData>('sec'),
		dataset<Record<string, Mention[]>>('news-index'),
		// Analistas, resultados y directivos (Finnhub): solo valores de EE. UU., unos pocos KB cada uno.
		dataset<AnalystsData>('analysts'),
		// Volumen en corto (FINRA): el último día y la media de unos mil valores de EE. UU., sin el historial (~30 KB).
		dataset<FinraData>('finra'),
		// RV: cifras de unos 60 valores de EE. UU. y de sus competidores (Finnhub), solo las que compara RV.
		dataset<PerfData>('perf'),
		dataset<PeersData>('peers')
	]);
	const rv = perf?.data.metrics && peers && {
		fetchedAt: perf.fetchedAt,
		metrics: rvMetrics(perf.data.metrics, peers.data.metrics),
		peers: Object.fromEntries(Object.entries(peers.data.symbols).map(([k, v]) => [k, v.peers]))
	};
	return { sec, news, analysts, finra: finra && { ...finra, data: summarize(finra.data) }, rv };
};
