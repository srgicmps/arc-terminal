import { dataset, type SourceStatus } from '#lib/data.ts';
import type { FinnhubData, HolidaysData } from '#lib/types.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	const [finnhub, holidays, status] = await Promise.all([
		dataset<FinnhubData>('finnhub'),
		dataset<HolidaysData>('holidays'),
		dataset<SourceStatus[]>('status')
	]);
	return { finnhub, holidays, status };
};
