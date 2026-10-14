import { dataset } from '#lib/data.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	const [news, hn, papers] = await Promise.all([
		dataset('news-ai'),
		dataset('hn'),
		dataset('hfpapers')
	]);
	return { news, hn, papers };
};
