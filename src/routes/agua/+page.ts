import { dataset } from '#lib/data.ts';
import type { WaterData } from '#lib/types.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => ({ water: await dataset<WaterData>('water') });
