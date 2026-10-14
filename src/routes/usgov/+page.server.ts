import { dataset } from '#lib/data.ts';
import { headlines } from '#lib/trim.ts';
import type { FedRegData, NewsData } from '#lib/types.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [fedreg, gov] = await Promise.all([dataset<FedRegData>('fedreg'), dataset<NewsData>('news-gov')]);
	// Los comunicados no enseñan el resumen.
	return { fedreg, gov: headlines(gov, 60) };
};
