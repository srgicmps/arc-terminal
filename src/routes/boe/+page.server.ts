import { dataset } from '#lib/data.ts';
import type { BoeData } from '#lib/types.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => ({ boe: await dataset<BoeData>('boe') });
