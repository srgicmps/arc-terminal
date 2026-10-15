// Feed: todos los sucesos en una sola lista (src/lib/exp/feed.ts). Se arma al construir y al navegador solo llegan
// los 150 más recientes, sin resúmenes.
import { dataset } from '#lib/data.ts';
import { FIGURES, FIGURE_SERIES, figures } from '#lib/exp/figures.ts';
import { mergeFeed, SECTION_TOPIC, type FeedItem } from '#lib/exp/feed.ts';
import { recordLabel, seriesRecord } from '#lib/records.ts';
import { seriesMap } from '#lib/series.ts';
import { pickSeries } from '#lib/trim.ts';
import type { ImpData, NewsData, Quake, ReleaseCalData, SeriesData } from '#lib/types.ts';
import type { PageServerLoad } from './$types';

const NEWS = Object.keys(SECTION_TOPIC);
/** Por sección, los más recientes (luego se ordena todo junto). */
const PER_SECTION = 25;

export const load: PageServerLoad = async () => {
	const [news, imp, releases, quakes, ...sets] = await Promise.all([
		Promise.all(NEWS.map((k) => dataset<NewsData>(`news-${k}`))),
		dataset<ImpData>('imp'),
		dataset<ReleaseCalData>('releases-cal'),
		dataset<Quake[]>('quakes'),
		...['ecb', 'eurostat', 'bls', 'fred'].map((n) => dataset<SeriesData>(n))
	]);
	const now = Date.parse(imp?.fetchedAt ?? news.find(Boolean)?.fetchedAt ?? '') || 0;

	const important: FeedItem[] = (imp?.data.current ?? []).slice(0, 6).map((c) => {
		const topic = SECTION_TOPIC[c.sections[0]] ?? 'mundo';
		return { id: `imp-${c.k}`, t: c.time ?? c.first, topic, kind: 'imp', title: c.title, titleEs: c.titleEs, lang: c.lang, url: c.url, source: c.sources.slice(0, 3).join(' · '), detail: `Lo cuentan ${c.sources.length} medios`, view: '/imp' };
	});

	const headlines: FeedItem[] = NEWS.flatMap((k, i) =>
		(news[i]?.data.items ?? [])
			.filter((n) => n.time)
			.slice(0, PER_SECTION)
			.map((n) => ({ id: n.url, t: n.time!, topic: SECTION_TOPIC[k], kind: 'news' as const, title: n.title, titleEs: n.titleEs, lang: n.lang, url: n.url, source: n.source }))
	);

	const published: FeedItem[] = (releases?.data.past ?? [])
		.filter((r) => Date.parse(r.date) <= now)
		.map((r) => ({ id: `rel-${r.date}-${r.title}`, t: r.date, topic: 'datos', kind: 'release', title: `Publicado: ${r.title}`, url: r.url, source: r.source, view: '/cal' }));

	const shakes: FeedItem[] = (quakes?.data ?? [])
		.filter((q) => q.mag >= 5.5 && now - Date.parse(q.time) < 3 * 86_400_000)
		.map((q) => ({ id: `q-${q.id}`, t: q.time, topic: 'avisos', kind: 'quake', title: `Terremoto de magnitud ${q.mag.toFixed(1).replace('.', ',')}: ${q.place}`, url: q.url, source: 'USGS', detail: q.tsunami ? 'Posible tsunami' : undefined, view: '/geo' }));

	// Mercados: el último movimiento de cada cifra diaria; y los récords de varios años de cualquier cifra.
	const get = seriesMap(...sets);
	const daily = figures(seriesMap(...sets.map((d) => pickSeries(d, FIGURE_SERIES, 3)))).filter((f) => /^\d{4}-\d{2}-\d{2}$/.test(f.t));
	const moves: FeedItem[] = daily.map((f) => ({ id: `m-${f.id}-${f.t}`, t: `${f.t}T20:00:00Z`, topic: 'mercados', kind: 'move', title: `${f.label}: ${f.text}`, source: f.source, detail: f.changeText ? `${f.changeText} en la última sesión` : undefined, view: f.view }));
	const records: FeedItem[] = FIGURES.flatMap((f) => {
		const s = get(f.series);
		const r = s ? seriesRecord(s.points) : null;
		const last = s?.points.at(-1);
		if (!r || !last) return [];
		const t = /^\d{4}-\d{2}-\d{2}$/.test(last.t) ? `${last.t}T20:00:00Z` : (sets.find((d) => d?.data.series.includes(s!))?.fetchedAt ?? '');
		return t ? [{ id: `r-${f.id}-${last.t}`, t, topic: f.section === 'mercados' ? 'mercados' : 'datos', kind: 'record', title: `Récord: ${f.label} en ${recordLabel(r)}`, source: s!.source, view: f.view }] : [];
	});

	return { fetchedAt: imp?.fetchedAt ?? null, items: mergeFeed([important, records, shakes, published, moves, headlines]) };
};
