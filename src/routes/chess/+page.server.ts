import type { Puzzle } from '#lib/chess/puzzle.ts';
import { dataset } from '#lib/data.ts';
import type { PageServerLoad } from './$types';

// Se ejecuta al construir la web: el problema del día (unos cientos de bytes) va dentro de la página.
export const load: PageServerLoad = async () => ({ lichess: await dataset<Puzzle>('lichess') });
