import { dataset } from '#lib/data.ts';
import type { NewsData, SeriesData } from '#lib/types.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	const [eurostat, ecb, bls, usdebt, news] = await Promise.all([
		dataset<SeriesData>('eurostat'),
		dataset<SeriesData>('ecb'),
		dataset<SeriesData>('bls'),
		dataset<SeriesData>('usdebt'),
		dataset<NewsData>('news-eco')
	]);
	return { eurostat, ecb, bls, usdebt, news };
};
