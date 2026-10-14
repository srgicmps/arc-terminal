import { dataset } from '#lib/data.ts';
import type { BoeData, EuLexDoc } from '#lib/types.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	const [boe, eurlex] = await Promise.all([dataset<BoeData>('boe'), dataset<EuLexDoc[]>('eurlex')]);
	return { boe, eurlex };
};
