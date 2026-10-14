import { dataset } from '#lib/data.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	const [fedreg, gov] = await Promise.all([dataset('fedreg'), dataset('news-gov')]);
	return { fedreg, gov };
};
