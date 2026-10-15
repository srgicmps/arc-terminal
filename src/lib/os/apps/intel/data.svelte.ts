// Datos del Centro de mando, compartidos por el Grafo y el Expediente: se piden una vez (titulares de todas las
// secciones, IMP, sanciones y sucesos), se construye el grafo y se guarda cinco minutos. Las cifras de un país
// (las de PAIS) y la agenda de los líderes se piden solo cuando un Expediente las necesita.
import { asset } from '$app/paths';
import { countryProfile, type CountryProfile } from '../../../country.ts';
import { COUNTRIES } from '../../../countries.ts';
import { NEWS_SECTIONS } from '../../../news.ts';
import type { GdacsEvent, ImfData, ImpData, LeaderAgenda, NewsData, SeriesData, TradeDoc, YieldCurveData } from '../../../types.ts';
import { buildGraph, type Graph } from './model.ts';

const TTL = 5 * 60_000;

let graph = $state.raw<Graph | null>(null);
export const intel = $state({ loading: false, error: '', at: 0 });
/** El grafo, si ya está (reactivo: leerlo en un $derived o en el marcado lo sigue). */
export const getGraph = () => graph;

async function getJson<T>(name: string): Promise<T | null> {
	try {
		const r = await fetch(asset(`data/${name}.json` as Parameters<typeof asset>[0]), { cache: 'no-store' });
		return r.ok ? (((await r.json()) as { data: T }).data ?? null) : null;
	} catch {
		return null;
	}
}

let pending: Promise<Graph> | null = null;

/** El grafo (de la caché si tiene menos de 5 min). Las dos apps comparten la misma petición. */
export function loadIntel(force = false): Promise<Graph> {
	if (graph && !force && Date.now() - intel.at < TTL) return Promise.resolve(graph);
	if (pending) return pending;
	intel.loading = true;
	pending = (async () => {
		const [sections, imp, us, uk, gdacs] = await Promise.all([
			Promise.all(NEWS_SECTIONS.map(async (s) => ((await getJson<NewsData>(`news-${s.key}`))?.items ?? []).map((i) => ({ ...i, section: s.key })))),
			getJson<ImpData>('imp'),
			getJson<TradeDoc[]>('sanctions'),
			getJson<TradeDoc[]>('sanctions-uk'),
			getJson<GdacsEvent[]>('gdacs')
		]);
		const g = buildGraph({ news: sections.flat(), imp, sanctions: [...(us ?? []), ...(uk ?? [])], events: gdacs ?? [] });
		graph = g;
		intel.at = Date.now();
		intel.error = sections.every((s) => !s.length) ? 'No han llegado titulares: el grafo solo tiene los registros fijos.' : '';
		return g;
	})().finally(() => {
		intel.loading = false;
		pending = null;
	});
	return pending;
}

let profiles: Promise<Map<string, CountryProfile>> | null = null;

/** Las cifras de PAIS de un país (PIB, IPC, paro, tipos, bono…). Se calculan para todos la primera vez. */
export async function loadProfile(code: string): Promise<CountryProfile | null> {
	profiles ??= (async () => {
		const [eurostat, ecb, bls, fred, bis, curve, imf] = await Promise.all([
			getJson<SeriesData>('eurostat'),
			getJson<SeriesData>('ecb'),
			getJson<SeriesData>('bls'),
			getJson<SeriesData>('fred'),
			getJson<SeriesData>('bis'),
			getJson<YieldCurveData>('uscurve'),
			getJson<ImfData>('imf')
		]);
		const sets = { series: [eurostat, ecb, bls, fred, bis].flatMap((d) => d?.series ?? []), curve, imf };
		return new Map(COUNTRIES.map((c) => [c.code, countryProfile(c, sets)]));
	})();
	return (await profiles).get(code) ?? null;
}

let agendas: Promise<LeaderAgenda[]> | null = null;

/** La agenda de un líder (de ayer a pasado mañana), si se ha podido leer. */
export async function loadAgenda(id: string): Promise<LeaderAgenda | null> {
	agendas ??= getJson<LeaderAgenda[]>('leaders').then((d) => d ?? []);
	return (await agendas).find((a) => a.id === id) ?? null;
}
