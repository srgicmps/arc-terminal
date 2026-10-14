import { dataset } from '#lib/data.ts';
import type { FedRegData, LeaderAgenda, NewsData } from '#lib/types.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	const [leaders, gov, fedreg] = await Promise.all([
		dataset<LeaderAgenda[]>('leaders'),
		dataset<NewsData>('news-gov'),
		dataset<FedRegData>('fedreg')
	]);
	return { leaders, gov, fedreg };
};
