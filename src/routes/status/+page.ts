import { dataset, type SourceStatus } from '#lib/data.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => ({ status: await dataset<SourceStatus[]>('status') });
