import { dataset } from '#lib/data.ts';
import { pickSeries } from '#lib/trim.ts';
import type { SeriesData } from '#lib/types.ts';
import type { PageServerLoad } from './$types';

// Solo el euríbor a 12 meses (BCE), con 3 años de historia: lo demás lo escribe cada uno en su navegador.
export const load: PageServerLoad = async () => ({
	ecb: pickSeries(await dataset<SeriesData>('ecb'), ['euribor-12m'], 36)
});
