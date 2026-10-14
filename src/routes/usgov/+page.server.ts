import { dataset } from '#lib/data.ts';
import { headlines, trim } from '#lib/trim.ts';
import type { FedRegData, NewsData, TradeDoc } from '#lib/types.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [fedreg, gov, sanctions] = await Promise.all([
		dataset<FedRegData>('fedreg'),
		dataset<NewsData>('news-gov'),
		dataset<TradeDoc[]>('sanctions')
	]);
	// Los comunicados no enseñan el resumen. De sanciones y aranceles, los 15 que se pintan.
	return { fedreg, gov: headlines(gov, 60), sanctions: trim(sanctions, (d) => d.slice(0, 15)) };
};
