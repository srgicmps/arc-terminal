// El mundo (app Sencilla): lo más importante de hoy y los titulares de cada tema, como historias.
import { world } from '#lib/sencillo/load.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => world(5);
