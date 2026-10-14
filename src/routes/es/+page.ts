import { dataset } from '#lib/data.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	const [news, gov, boe, power, eurostat, ecb, fuel, quakes, ine] = await Promise.all([
		dataset('news-es'),
		dataset('news-gov'),
		dataset('boe'),
		dataset('power'),
		dataset('eurostat'),
		dataset('ecb'),
		dataset('fuel-es'),
		dataset('quakes-es'),
		dataset('ine')
	]);
	return { news, gov, boe, power, eurostat, ecb, fuel, quakes, ine };
};
