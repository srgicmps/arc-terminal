import { dataset } from '#lib/data.ts';
import type { FundsData } from '#lib/types.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => ({ funds: await dataset<FundsData>('funds') });
