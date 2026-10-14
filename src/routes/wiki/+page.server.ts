import { dataset } from '#lib/data.ts';
import type { WikiData } from '#lib/types.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => ({ wiki: await dataset<WikiData>('wiki') });
