import { dataset } from '#lib/data.ts';
import type { PerfData } from '#lib/types.ts';
import type { PageServerLoad } from './$types';

// Rentabilidad por plazos de los grandes valores de EE. UU. (Finnhub, clave opcional): sin ella no hay tabla.
// Va entera (unos 60 valores × 6 cifras): los que se comparan se leen de la URL ya en el navegador.
// Sin las cifras de valoración (metrics), que son de RV.
export const load: PageServerLoad = async () => {
	const perf = await dataset<PerfData>('perf');
	return { perf: perf && { ...perf, data: { symbols: perf.data.symbols } } };
};
