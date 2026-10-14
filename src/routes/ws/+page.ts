import { dataset } from '#lib/data.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	const [news, curve, ecb, crypto] = await Promise.all([
		dataset('news-ws'),
		dataset('uscurve'),
		dataset('ecb'),
		dataset('crypto')
	]);
	return { news, curve, ecb, crypto };
};
