// Radio: lo que necesita el informativo hablado, recortado (los 5 titulares de IMP, los dos últimos puntos de
// cada serie, las publicaciones de hoy y mañana, resultados y cotizaciones). La vista arma el programa en el
// navegador con la hora de quien escucha (radio.ts → buildProgram) y le añade sus valores.
import { json } from '@sveltejs/kit';
import { catalogOf, extract } from '#lib/gseries.ts';
import { MACRO_SERIES, MARKET_SERIES } from '#lib/exp/radio.ts';
import type { FinnhubData, ImpData, Point, Quote, ReleaseCalData } from '#lib/types.ts';

export const prerender = true;

const files = import.meta.glob('/static/data/*.json', { import: 'default' });
const load = async <T>(name: string) => ((await files[`/static/data/${name}.json`]?.()) as { data?: T } | undefined)?.data ?? null;

export async function GET() {
	const wanted = new Set<string>([...MARKET_SERIES, ...MACRO_SERIES].map((s) => s.id));
	const series: Record<string, Point[]> = {};
	for (const [path, read] of Object.entries(files)) {
		if (wanted.size === Object.keys(series).length) break;
		const ds = path.slice('/static/data/'.length, -'.json'.length);
		const data = ((await read()) as { data?: unknown })?.data;
		for (const entry of catalogOf(ds, data)) {
			if (!wanted.has(entry.id) || series[entry.id]) continue;
			const points = extract(data, entry);
			if (points.length >= 2) series[entry.id] = points.slice(-2);
		}
	}
	const [imp, cal, finnhub, quotes] = await Promise.all([
		load<ImpData>('imp'),
		load<ReleaseCalData>('releases-cal'),
		load<FinnhubData>('finnhub'),
		load<Quote[]>('alert-quotes')
	]);
	const now = Date.now();
	const soon = (iso: string) => Date.parse(iso) >= now - 86_400_000 && Date.parse(iso) <= now + 2 * 86_400_000;
	const data = {
		headlines: (imp?.current ?? []).slice(0, 5).map((h) => ({ title: h.title, titleEs: h.titleEs, lang: h.lang, sources: h.sources })),
		series,
		releases: (cal?.events ?? []).filter((r) => soon(r.date)),
		earnings: (finnhub?.earnings ?? []).filter((e) => soon(`${e.date}T12:00:00Z`)).map(({ date, symbol, hour }) => ({ date, symbol, hour })),
		quotes: quotes ?? []
	};
	return json({ name: 'radio', fetchedAt: new Date().toISOString(), data });
}
