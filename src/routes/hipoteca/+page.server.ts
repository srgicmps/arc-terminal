import { dataset } from '#lib/data.ts';
import { euriborPhrase, phrases } from '#lib/plain.ts';
import { pickSeries } from '#lib/trim.ts';
import type { SeriesData } from '#lib/types.ts';
import type { PageServerLoad } from './$types';

// Solo el euríbor a 12 meses (BCE), con 3 años de historia: lo demás lo escribe cada uno en su navegador.
export const load: PageServerLoad = async () => {
	const ecb = pickSeries(await dataset<SeriesData>('ecb'), ['euribor-12m'], 36);
	// Modo Sencillo: el euríbor frente a hace un año, en una frase (plain.ts) escrita al construir.
	const plain = phrases([euriborPhrase(ecb?.data.series.find((s) => s.id === 'euribor-12m')?.points)]);
	return { ecb, plain };
};
