// Sala de control: los puntos y el último minuto salen de src/lib/exp/sala-data.ts (los comparte con GLOBO).
import { salaData } from '#lib/exp/sala-data.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = salaData;
