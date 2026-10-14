import { dataset } from '#lib/data.ts';
import type { BoeData } from '#lib/types.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => ({ boe: await dataset<BoeData>('boe') });
