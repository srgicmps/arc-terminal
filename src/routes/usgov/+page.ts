import { dataset } from '#lib/data.ts';
import type { FedRegData, NewsData, TradeDoc } from '#lib/types.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	const [fedreg, gov, sanctions] = await Promise.all([
		dataset<FedRegData>('fedreg'),
		dataset<NewsData>('news-gov'),
		dataset<TradeDoc[]>('sanctions')
	]);
	return { fedreg, gov, sanctions };
};
