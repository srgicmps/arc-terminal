import { dataset } from '#lib/data.ts';
import type { FedRegData, NewsData } from '#lib/types.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	const [fedreg, gov] = await Promise.all([dataset<FedRegData>('fedreg'), dataset<NewsData>('news-gov')]);
	return { fedreg, gov };
};
