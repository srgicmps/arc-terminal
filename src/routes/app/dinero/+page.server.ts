// Tu dinero (app Sencilla): las cifras que tocan el bolsillo, ya en tarjetas.
import { money } from '#lib/sencillo/load.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => money();
