import { dataset } from '#lib/data.ts';
import type { ShipsData } from '#lib/types.ts';
import type { PageServerLoad } from './$types';

// La tabla enseña todos los barcos guardados (unos pocos por puerto): no hace falta recortar filas.
export const load: PageServerLoad = async () => ({ ships: await dataset<ShipsData>('ais') });
