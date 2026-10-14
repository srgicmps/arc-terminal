import { dataset } from '#lib/data.ts';
import type { FinnhubData, HolidaysData } from '#lib/types.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	const [finnhub, holidays] = await Promise.all([dataset<FinnhubData>('finnhub'), dataset<HolidaysData>('holidays')]);
	return { finnhub, holidays };
};
