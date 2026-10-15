// Zen: los temas de IMP y las cifras del día, ya en el orden en que se enseñan (src/lib/exp/zen.ts).
import { loadFigures, loadTop } from '#lib/exp/load.ts';
import { zenCards } from '#lib/exp/zen.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [imp, figures] = await Promise.all([loadTop(8), loadFigures()]);
	return { fetchedAt: imp.fetchedAt, cards: zenCards(imp.top, figures) };
};
