import { dataset } from '#lib/data.ts';
import type { FuelData, FuelSpainData } from '#lib/fuel.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	const [fuel, spain] = await Promise.all([dataset<FuelData>('fuel'), dataset<FuelSpainData>('fuel-es')]);
	return { fuel, spain };
};
