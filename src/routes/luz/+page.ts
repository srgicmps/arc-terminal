import { dataset } from '#lib/data.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	const [power, mix] = await Promise.all([dataset('power'), dataset('power-mix')]);
	return { power, mix };
};
