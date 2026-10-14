// NOVEDADES: se ejecuta al construir la web (como las demás vistas); el navegador recibe solo la lista.
import { dataset } from '#lib/data.ts';
import type { ChangesData } from '#lib/types.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => ({ changes: await dataset<ChangesData>('changes') });
