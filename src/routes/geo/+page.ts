import { dataset } from '#lib/data.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	const [news, gov, quakes, quakesEs, hazards, predictions] = await Promise.all([
		dataset('news-geo'),
		dataset('news-gov'),
		dataset('quakes'),
		dataset('quakes-es'),
		dataset('hazards'),
		dataset('predictions')
	]);
	return { news, gov, quakes, quakesEs, hazards, predictions };
};
