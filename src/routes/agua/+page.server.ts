import { dataset } from '#lib/data.ts';
import type { WaterData } from '#lib/types.ts';
import type { PageServerLoad } from './$types';

// El historial semanal de 10 años lo pinta el gráfico entero, así que no se recorta.
export const load: PageServerLoad = async () => ({ water: await dataset<WaterData>('water') });
