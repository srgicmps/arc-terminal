import { dataset } from '#lib/data.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	const [eurostat, ecb, bls, usdebt, fred, bis, news, predictions] = await Promise.all([
		dataset('eurostat'),
		dataset('ecb'),
		dataset('bls'),
		dataset('usdebt'),
		dataset('fred'),
		dataset('bis'),
		dataset('news-eco'),
		dataset('predictions')
	]);
	return { eurostat, ecb, bls, usdebt, fred, bis, news, predictions };
};
