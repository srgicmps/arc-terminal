import { dataset, type SourceStatus } from '#lib/data.ts';
import type { NewsData } from '#lib/types.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const status = await dataset<SourceStatus[]>('status');
	// Salud de los canales RSS: se lee el JSON de cada sección de titulares (news-eco, news-geo…).
	const names = (status?.data ?? []).map((r) => r.name).filter((n) => n.startsWith('news-'));
	const rss = await Promise.all(
		names.map(async (name) => ({ name, feeds: (await dataset<NewsData>(name))?.data.feeds ?? [] }))
	);
	return { status, rss: rss.filter((s) => s.feeds.length) };
};
