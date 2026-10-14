import { dataset, type SourceHistory, type SourceStatus } from '#lib/data.ts';
import type { NewsData } from '#lib/types.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	// El historial va aparte para que status.json, que se carga en todas las vistas, siga siendo ligero.
	const [status, history] = await Promise.all([
		dataset<SourceStatus[]>('status'),
		dataset<SourceHistory[]>('status-history')
	]);
	// Salud de los canales RSS: se lee el JSON de cada sección de titulares (news-eco, news-geo…).
	const names = (status?.data ?? []).map((r) => r.name).filter((n) => n.startsWith('news-'));
	const rss = await Promise.all(
		names.map(async (name) => ({ name, feeds: (await dataset<NewsData>(name))?.data.feeds ?? [] }))
	);
	return { status, history, rss: rss.filter((s) => s.feeds.length) };
};
