import { dataset } from '#lib/data.ts';
import type { PowerData, PowerMixData } from '#lib/types.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [power, mix] = await Promise.all([dataset<PowerData>('power'), dataset<PowerMixData>('power-mix')]);
	return { power, mix };
};
