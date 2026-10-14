import { dataset } from '#lib/data.ts';
import type { ShipsData } from '#lib/types.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => ({ ships: await dataset<ShipsData>('ais') });
