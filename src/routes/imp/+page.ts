import { dataset } from '#lib/data.ts';
import type { ImpData } from '#lib/types.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => ({ imp: await dataset<ImpData>('imp') });
