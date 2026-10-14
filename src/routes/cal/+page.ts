import { dataset } from '#lib/data.ts';
import type { FinnhubData } from '#lib/types.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => ({ finnhub: await dataset<FinnhubData>('finnhub') });
