import type { AiModel } from '#lib/aimodels.ts';
import { dataset } from '#lib/data.ts';
import type { FrontierData } from '#lib/epoch.ts';
import type { HfModel, HnItem, NewsData, Paper } from '#lib/types.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [news, hn, papers, models, newModels, frontier] = await Promise.all([
		dataset<NewsData>('news-ai'),
		dataset<HnItem[]>('hn'),
		dataset<Paper[]>('hfpapers'),
		dataset<HfModel[]>('hfmodels'),
		dataset<AiModel[]>('aimodels'),
		dataset<FrontierData>('epoch')
	]);
	return { news, hn, papers, models, newModels, frontier };
};
