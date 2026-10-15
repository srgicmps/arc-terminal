// Tu casa (app Sencilla): luz, gasolina, tiempo, aire y avisos del tiempo, recortados al construir.
import { home } from '#lib/sencillo/load.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => home();
