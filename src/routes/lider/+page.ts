import { dataset } from '#lib/data.ts';
import type { FedRegData, LeaderAgenda, NewsData } from '#lib/types.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	const [leaders, gov, eco, fedreg] = await Promise.all([
		dataset<LeaderAgenda[]>('leaders'),
		dataset<NewsData>('news-gov'),
		dataset<NewsData>('news-eco'),
		dataset<FedRegData>('fedreg')
	]);
	return { leaders, gov, eco, fedreg };
};
