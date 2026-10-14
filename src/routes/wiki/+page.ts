import { dataset } from '#lib/data.ts';
import type { WikiData } from '#lib/types.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => ({ wiki: await dataset<WikiData>('wiki') });
