import { dataset } from '#lib/data.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	const [finnhub, holidays] = await Promise.all([dataset('finnhub'), dataset('holidays')]);
	return { finnhub, holidays };
};
