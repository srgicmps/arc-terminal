import type { AiModel } from '#lib/aimodels.ts';
import { dataset } from '#lib/data.ts';
import type { HfModel, HnItem, NewsData, Paper } from '#lib/types.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [news, hn, papers, models, newModels] = await Promise.all([
		dataset<NewsData>('news-ai'),
		dataset<HnItem[]>('hn'),
		dataset<Paper[]>('hfpapers'),
		dataset<HfModel[]>('hfmodels'),
		dataset<AiModel[]>('aimodels')
	]);
	return { news, hn, papers, models, newModels };
};
