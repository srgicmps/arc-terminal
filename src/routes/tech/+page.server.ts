import { dataset } from '#lib/data.ts';
import { headlines, trim } from '#lib/trim.ts';
import type { HnItem, KevData, NewsData, Release, TradeDoc } from '#lib/types.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [news, hn, releases, kev, sanctions, reg] = await Promise.all([
		dataset<NewsData>('news-tech'),
		dataset<HnItem[]>('hn'),
		dataset<Release[]>('releases'),
		dataset<KevData>('cisa-kev'),
		dataset<TradeDoc[]>('sanctions'),
		dataset<NewsData>('news-reg')
	]);
	// Chips y control de exportaciones (M33): solo las normas de la BIS, las de chips primero; 8 como mucho.
	const exports = trim(sanctions, (d) =>
		d
			.filter((x) => x.agency === 'BIS')
			.sort((a, b) => Number(b.topic === 'Chips') - Number(a.topic === 'Chips') || b.date.localeCompare(a.date))
			.slice(0, 8)
	);
	return { news, hn, releases, kev, exports, reg: headlines(reg, 12) };
};
