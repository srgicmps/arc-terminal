import { dataset } from '#lib/data.ts';
import { pickSeries } from '#lib/trim.ts';
import type { FinnhubData, Quote, SeriesData } from '#lib/types.ts';
import type { PageServerLoad } from './$types';

// Solo cotizaciones y cambios del BCE: las posiciones de cada uno no salen nunca de su navegador y su cuenta.
export const load: PageServerLoad = async () => {
	const [alert, finnhub, ecb] = await Promise.all([
		dataset<Quote[]>('alert-quotes'),
		dataset<FinnhubData>('finnhub'),
		dataset<SeriesData>('ecb')
	]);
	const quotes = new Map<string, Quote>();
	for (const q of [...(finnhub?.data.quotes ?? []), ...(alert?.data ?? [])]) quotes.set(q.symbol, q);
	const fx = pickSeries(ecb, null, 1);
	return {
		quotes: [...quotes.values()],
		quotesAt: alert?.fetchedAt ?? finnhub?.fetchedAt ?? null,
		fx: fx ? fx.data.series.filter((s) => /^eur[a-z]{3}$/.test(s.id)) : [],
		// Próximos resultados (2 semanas): se cruzan con tus posiciones en el navegador.
		earnings: finnhub?.data.earnings ?? []
	};
};
