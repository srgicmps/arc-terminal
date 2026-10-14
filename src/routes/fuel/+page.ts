import { dataset } from '#lib/data.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	const [fuel, spain] = await Promise.all([dataset('fuel'), dataset('fuel-es')]);
	return { fuel, spain };
};
