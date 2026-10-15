// Sala de control (experiencia /x/sala): todo lo geolocalizado en un mapa, por capas, con lo nuevo destellando
// por región. Lógica pura: convierte cada fuente en puntos con hora y región. Las capas de la naturaleza y los
// estrechos salen de las de GEO (src/lib/geo/layers.ts); aquí se añaden conflictos, avisos de viaje, elecciones,
// cortes de internet y alertas de GDACS.
import { COUNTRIES, countryByName, findCountries } from '../countries.ts';
import type { MapPoint } from '../geo/layers.ts';
import { regionOf, REGIONS, type RegionId } from '../regions.ts';
import type { AdvisoriesData, Election, GdacsEvent, IodaOutage, NewsItem } from '../types.ts';

export const SALA_LAYERS = [
	{ value: 'conflict', label: 'Conflictos' },
	{ value: 'quakes', label: 'Terremotos' },
	{ value: 'disasters', label: 'Catástrofes' },
	{ value: 'travel', label: 'Avisos de viaje' },
	{ value: 'elections', label: 'Elecciones' },
	{ value: 'internet', label: 'Cortes de internet' },
	{ value: 'airspace', label: 'Espacio aéreo' },
	{ value: 'straits', label: 'Estrechos' }
] as const;

export type SalaLayer = (typeof SALA_LAYERS)[number]['value'];

export interface SalaPoint extends Omit<MapPoint, 'layer'> {
	layer: SalaLayer;
	/** Cuándo pasó (ISO 8601), para marcar lo nuevo; null si es un estado (un estrecho). */
	t: string | null;
	region: RegionId | null;
}

/** Región por coordenadas, para lo que no tiene país (un terremoto en el mar). Cajas aproximadas. */
export function regionAt(lat: number, lon: number): RegionId | null {
	if (lon < -30) return 'america';
	if (lat > 35 && lon < 45) return 'europa';
	if (lat > 12 && lat <= 42 && lon >= 25 && lon < 63) return 'oriente';
	if (lat <= 37 && lon >= -20 && lon < 52) return 'africa';
	if (lon >= 45) return 'asia';
	return null;
}

const center = (code: string) => COUNTRIES.find((c) => c.code === code)?.center;

/** Un poco de dispersión para que varios puntos del mismo país no se tapen. */
const jitter = (i: number): [number, number] => [((i * 37) % 7) - 3, ((i * 53) % 9) - 4].map((v) => v * 0.6) as [number, number];

/** Titulares de geopolítica: un punto por país nombrado (los 2 primeros), en el centro del país. */
export function conflictPoints(items: Pick<NewsItem, 'title' | 'titleEs' | 'url' | 'source' | 'time'>[]): SalaPoint[] {
	const perCountry = new Map<string, number>();
	return items.flatMap((n, i) =>
		findCountries(n.title)
			.slice(0, 2)
			.flatMap((c) => {
				const k = perCountry.get(c.code) ?? 0;
				perCountry.set(c.code, k + 1);
				if (k >= 4) return [];
				const [dy, dx] = jitter(k);
				return [{ id: `n-${i}-${c.code}`, layer: 'conflict' as const, lat: c.center[0] + dy, lon: c.center[1] + dx, r: 1.3, title: n.titleEs ?? n.title, sub: `${c.name} · ${n.source}`, url: n.url, t: n.time, region: regionOf(c.code) ?? regionAt(c.center[0], c.center[1]), country: c.code }];
			})
	);
}

export function travelPoints(data: AdvisoriesData | undefined): SalaPoint[] {
	return (data?.items ?? [])
		.filter((a) => a.level >= 3)
		.flatMap((a) => {
			const c = countryByName(a.name);
			if (!c) return [];
			return [{ id: `a-${c.code}`, layer: 'travel' as const, lat: c.center[0], lon: c.center[1], r: a.level === 4 ? 2.4 : 1.6, strong: a.level === 4, title: `${c.name}: nivel ${a.level} de 4`, sub: a.level === 4 ? 'EE. UU. desaconseja viajar' : 'EE. UU. pide reconsiderar el viaje', url: a.url, t: a.changedAt ?? null, region: regionOf(c.code) ?? regionAt(c.center[0], c.center[1]), country: c.code }];
		});
}

/** Elecciones de los próximos `days` días. */
export function electionPoints(items: Election[] | undefined, now: number, days = 30): SalaPoint[] {
	return (items ?? []).flatMap((e, i) => {
		const at = e.iso ? center(e.iso) : undefined;
		const t = Date.parse(`${e.date}T12:00:00Z`);
		if (!at || !(t >= now - 86_400_000 && t <= now + days * 86_400_000)) return [];
		return [{ id: `el-${e.iso}-${e.date}-${i}` /* con el índice: dos elecciones el mismo día (presidenciales y legislativas) */, layer: 'elections' as const, lat: at[0], lon: at[1], r: 1.6, title: e.name, sub: `${e.country} · ${e.date}`, url: e.url, t: null, region: regionOf(e.iso!) ?? regionAt(at[0], at[1]), country: e.iso! }];
	});
}

export function outagePoints(items: IodaOutage[] | undefined): SalaPoint[] {
	return (items ?? []).flatMap((o) => {
		const at = center(o.code);
		if (!at) return [];
		return [{ id: `i-${o.code}`, layer: 'internet' as const, lat: at[0], lon: at[1], r: o.level === 'critical' ? 2.2 : 1.5, strong: o.level === 'critical', title: `Corte de internet en ${o.name}`, sub: o.drop !== null ? `La señal cae un ${Math.round(o.drop)} %` : 'Señales en alerta', url: `https://ioda.inetintel.cc.gatech.edu/country/${o.code}`, t: o.since, region: regionOf(o.code) ?? regionAt(at[0], at[1]), country: o.code }];
	});
}

export function gdacsPoints(items: GdacsEvent[] | undefined): SalaPoint[] {
	return (items ?? [])
		.filter((g) => g.lat !== null && g.lon !== null)
		.map((g) => ({ id: `g-${g.id}`, layer: 'disasters' as const, lat: g.lat!, lon: g.lon!, r: g.level === 'red' ? 2.6 : 1.8, strong: g.level === 'red', title: `${g.kind}: ${g.name}`, sub: `${g.country} · alerta ${g.level === 'red' ? 'roja' : 'naranja'}`, url: g.url, t: g.updated ?? g.from, region: regionAt(g.lat!, g.lon!) }));
}

/** Puntos de las capas de GEO (MapPoint) en la Sala, con su hora si la tienen. */
export function fromGeo(points: MapPoint[], layer: SalaLayer, times: Record<string, string | null> = {}): SalaPoint[] {
	return points.map((p) => ({ ...p, layer, t: times[p.id] ?? null, region: (p.country && regionOf(p.country)) || regionAt(p.lat, p.lon) }));
}

/** Lo nuevo de cada región (los puntos con hora posterior a `since`). */
export function newByRegion(points: SalaPoint[], since: string | null): { id: RegionId; label: string; count: number }[] {
	const l = since ? Date.parse(since) : NaN;
	return REGIONS.map((r) => ({
		id: r.id,
		label: r.label,
		count: Number.isFinite(l) ? points.filter((p) => p.region === r.id && p.t && Date.parse(p.t) > l).length : 0
	}));
}
