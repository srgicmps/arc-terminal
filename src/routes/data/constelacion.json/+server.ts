// Constelación: el grafo de quién sale con quién en los titulares de las últimas 72 h, con las posiciones ya
// calculadas (src/lib/exp/constelacion.ts). Se genera al construir; la vista lo pide al abrirse.
import { json } from '@sveltejs/kit';
import { dataset } from '#lib/data.ts';
import { buildGraph } from '#lib/exp/constelacion.ts';
import { NEWS_SECTIONS } from '#lib/news.ts';
import type { NewsData } from '#lib/types.ts';

export const prerender = true;

export async function GET() {
	const sections = await Promise.all(NEWS_SECTIONS.map((s) => dataset<NewsData>(`news-${s.key}`)));
	const items = sections.flatMap((d) => d?.data.items ?? []);
	return json({ name: 'constelacion', fetchedAt: new Date().toISOString(), data: buildGraph(items, Date.now()) });
}
