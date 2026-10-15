import { dataset } from '#lib/data.ts';
import type { F1Data, FootballData } from '#lib/sports.ts';
import type { PageServerLoad } from './$types';

// Dos archivos pequeños (unos pocos KB): la vista enseña todo.
export const load: PageServerLoad = async () => {
	const [football, f1] = await Promise.all([dataset<FootballData>('football'), dataset<F1Data>('f1')]);
	return { football, f1 };
};
