import { dataset } from '#lib/data.ts';
import type { FinnhubData, HolidaysData, ReleaseCalData } from '#lib/types.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	const [finnhub, holidays, releases] = await Promise.all([
		dataset<FinnhubData>('finnhub'),
		dataset<HolidaysData>('holidays'),
		dataset<ReleaseCalData>('releases-cal')
	]);
	return { finnhub, holidays, releases };
};
