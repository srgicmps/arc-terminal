import { dataset } from '#lib/data.ts';
import type { PowerData } from '#lib/types.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => ({ power: await dataset<PowerData>('power') });
