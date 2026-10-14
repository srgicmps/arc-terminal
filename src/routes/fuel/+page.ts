import { dataset } from '#lib/data.ts';
import type { FuelData } from '#lib/fuel.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	return { fuel: await dataset<FuelData>('fuel') };
};
