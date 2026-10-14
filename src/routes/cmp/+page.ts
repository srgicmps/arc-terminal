import { dataset } from '#lib/data.ts';
import type { PerfData } from '#lib/types.ts';
import type { PageLoad } from './$types';

// Rentabilidad por plazos de los grandes valores de EE. UU. (Finnhub, clave opcional): sin ella no hay tabla.
export const load: PageLoad = async () => ({ perf: await dataset<PerfData>('perf') });
