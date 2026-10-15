import { dataset } from '#lib/data.ts';
import type { Mention } from '#lib/news.ts';
import { summarize, type FinraData } from '#lib/shortvol.ts';
import { holdersFromTop, issuersFor } from '#lib/holders.ts';
import { TICKERS } from '#lib/tickers.ts';
import type { AnalystsData, FundsData, SecData } from '#lib/types.ts';
import type { PageServerLoad } from './$types';

// Los documentos de la SEC y los titulares de todos los valores (dos archivos pequeños); la vista
// elige los suyos.
export const load: PageServerLoad = async () => {
	const [sec, news, analysts, finra, funds] = await Promise.all([
		dataset<SecData>('sec'),
		dataset<Record<string, Mention[]>>('news-index'),
		// Analistas, resultados y directivos (Finnhub): solo valores de EE. UU., unos pocos KB cada uno.
		dataset<AnalystsData>('analysts'),
		// Volumen en corto (FINRA): el último día y la media de unos mil valores de EE. UU., sin el historial (~30 KB).
		dataset<FinraData>('finra'),
		// Fondos de FONDOS que tienen cada valor de la barra (HDS): solo los de EE. UU. que salen en el índice.
		dataset<FundsData>('funds')
	]);
	const issuers = funds ? (funds.data.holders ?? holdersFromTop(funds.data.funds)) : [];
	const holders = Object.fromEntries(
		TICKERS.filter((t) => t.cik)
			.map((t) => [t.code, issuersFor(t.code, issuers).map((e) => ({ name: e.name, holders: e.holders.map(({ shares: _, ...h }) => h) }))] as const)
			.filter(([, list]) => list.length)
	);
	const fundNames = Object.fromEntries((funds?.data.funds ?? []).map((f) => [f.key, f.name]));
	return {
		sec,
		news,
		analysts,
		finra: finra && { ...finra, data: summarize(finra.data) },
		hds: funds && { fetchedAt: funds.fetchedAt, holders, fundNames }
	};
};
