import { dataset } from '#lib/data.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	const [news, hn, releases] = await Promise.all([
		dataset('news-tech'),
		dataset('hn'),
		dataset('releases')
	]);
	return { news, hn, releases };
};
