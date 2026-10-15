import { dataset } from '#lib/data.ts';
import { stories } from '#lib/coverage.ts';
import { NEWS_SECTIONS } from '#lib/news.ts';
import type { NewsData } from '#lib/types.ts';
import type { PageServerLoad } from './$types';

// Todas las secciones de titulares; se agrupan aquí, al construir, y a la página solo le llegan las 25 historias.
export const load: PageServerLoad = async () => {
	const sets = await Promise.all(NEWS_SECTIONS.map((s) => dataset<NewsData>(`news-${s.key}`)));
	const items = sets.flatMap((d) => d?.data.items ?? []);
	const fetchedAt = sets.map((d) => d?.fetchedAt ?? '').sort().at(-1) || null;
	return { stories: stories(items), fetchedAt };
};
