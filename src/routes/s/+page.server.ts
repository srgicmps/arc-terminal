import { dataset } from '#lib/data.ts';
import type { SecData } from '#lib/types.ts';
import type { PageServerLoad } from './$types';

// Los documentos de la SEC de todos los valores (un solo archivo pequeño); la vista elige el suyo.
export const load: PageServerLoad = async () => {
	const sec = await dataset<SecData>('sec');
	return { sec };
};
