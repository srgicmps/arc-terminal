// Buscar (app Sencilla): los titulares de cada tema (solo título, medio, enlace y hora) para buscar en el navegador.
import { world } from '#lib/sencillo/load.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const w = await world(30);
	return { stories: w.sections.flatMap((s) => s.stories) };
};
