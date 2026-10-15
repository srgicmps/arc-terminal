// Capas del mapa de GEO: convierte cada conjunto de datos en puntos con la misma forma, para que
// WorldMap solo tenga que dibujarlos. Funciones puras, con tests.
import { findCountries } from '../countries.ts';
import { nf } from '../format.ts';
import { AREAS, type Czib } from '../czib.ts';
import type { NavWarning } from '../navwarn.ts';
import type { Chokepoint, NaturalEvent, Quake, Storm } from '../types.ts';

/** Lo que hace falta de un documento de sanciones o aranceles (sanctions.json). */
export interface TradeLike {
	title: string;
	abstract: string;
	url: string;
}

export type LayerId = 'quakes' | 'storms' | 'events' | 'straits' | 'sanctions' | 'airspace' | 'maritime';

export const LAYERS: { value: LayerId; label: string }[] = [
	{ value: 'quakes', label: 'Terremotos' },
	{ value: 'storms', label: 'Ciclones' },
	{ value: 'events', label: 'Incendios y volcanes' },
	{ value: 'straits', label: 'Estrechos' },
	{ value: 'sanctions', label: 'Sanciones' },
	{ value: 'airspace', label: 'Espacio aéreo' },
	{ value: 'maritime', label: 'Avisos a barcos' }
];

export interface MapPoint {
	id: string;
	layer: LayerId;
	lat: number;
	lon: number;
	/** Radio en unidades del mapa (1 = 1 grado). */
	r: number;
	/** Más intenso: terremoto fuerte, estrecho con mucha caída, país con muchas sanciones. */
	strong?: boolean;
	title: string;
	sub: string;
	url: string;
	/** ISO 3166-1 alfa-2 si el punto es un país: la ficha enlaza a PAIS. */
	country?: string;
}

/** Coordenadas de los estrechos de PortWatch (centro aproximado del paso). */
export const STRAITS: Record<string, [number, number]> = {
	chokepoint6: [26.57, 56.25], // Ormuz
	chokepoint1: [30.6, 32.33], // Suez
	chokepoint4: [12.58, 43.33], // Bab el-Mandeb
	chokepoint2: [9.08, -79.68], // Panamá
	chokepoint5: [2.5, 101.4], // Malaca
	chokepoint3: [41.12, 29.07] // Bósforo
};

/**
 * Países que nombra un texto (sanciones, aranceles), con su centro para el mapa: los de
 * findCountries() (src/lib/countries.ts, los mismos que PAIS) y, aparte, la Unión Europea, que no es país.
 */
const EU = { name: 'Unión Europea', code: undefined, at: [50.1, 9.7] as [number, number] };
export const countriesIn = (text: string): { name: string; code?: string; at: [number, number] }[] => [
	...findCountries(text).map((c) => ({ name: c.name, code: c.code, at: c.center })),
	...(/\b(European Union|EU)\b/.test(text) ? [EU] : [])
];

const ok = (lat: number, lon: number) => Number.isFinite(lat) && Number.isFinite(lon);

export const quakePoints = (quakes: Quake[]): MapPoint[] =>
	quakes
		.filter((q) => ok(q.lat, q.lon))
		.map((q) => ({
			id: `q-${q.id}`,
			layer: 'quakes',
			lat: q.lat,
			lon: q.lon,
			r: Math.max(0.8, (q.mag - 4) * 1.1),
			strong: q.mag >= 6,
			title: `Terremoto M${nf(q.mag, 1)}`,
			sub: q.place,
			url: q.url
		}));

export const stormPoints = (storms: Storm[]): MapPoint[] =>
	storms
		.filter((s) => ok(s.lat, s.lon))
		.map((s) => ({ id: `s-${s.id}`, layer: 'storms', lat: s.lat, lon: s.lon, r: 2.6, title: s.name, sub: s.classification, url: s.url }));

export const eventPoints = (events: NaturalEvent[]): MapPoint[] =>
	events
		.filter((e) => ok(e.lat, e.lon))
		.map((e) => ({ id: `e-${e.id}`, layer: 'events', lat: e.lat, lon: e.lon, r: 0.9, title: e.title, sub: e.category, url: e.url }));

/** Estrechos: más grandes cuanto más tráfico; intensos si caen más de un 10 % frente al año anterior. */
export const straitPoints = (items: Chokepoint[]): MapPoint[] =>
	items.flatMap((c) => {
		const at = STRAITS[c.id];
		if (!at) return [];
		return [
			{
				id: `c-${c.id}`,
				layer: 'straits' as const,
				lat: at[0],
				lon: at[1],
				r: 1.2 + Math.min(2.4, c.avg7 / 60),
				strong: c.change !== null && c.change <= -10,
				title: c.name,
				sub: `${nf(c.avg7, 0)} barcos al día${c.change === null ? '' : ` · ${c.change > 0 ? '+' : ''}${nf(c.change, 1)} % en un año`}`,
				url: 'https://portwatch.imf.org/pages/chokepoints'
			}
		];
	});

/** Sanciones y aranceles agrupados por país: un punto por país, más grande cuantos más documentos. */
export function sanctionPoints(docs: TradeLike[]): MapPoint[] {
	const by = new Map<string, { at: [number, number]; code?: string; docs: TradeLike[] }>();
	for (const d of docs) {
		for (const c of countriesIn(`${d.title} ${d.abstract}`)) {
			const entry = by.get(c.name) ?? { at: c.at, code: c.code, docs: [] };
			entry.docs.push(d);
			by.set(c.name, entry);
		}
	}
	return [...by.entries()].map(([name, { at, code, docs }]) => ({
		id: `x-${name}`,
		layer: 'sanctions',
		lat: at[0],
		lon: at[1],
		r: 1.2 + Math.min(2.4, docs.length * 0.6),
		strong: docs.length >= 3,
		title: `${name}: ${docs.length} ${docs.length === 1 ? 'documento' : 'documentos'}`,
		sub: docs[0].title,
		url: docs[0].url,
		country: code
	}));
}

/** Espacio aéreo en conflicto (CZIB de la EASA, F22): un punto por boletín, en el centro del país o de la zona. */
export const airspacePoints = (items: Czib[]): MapPoint[] =>
	items.flatMap((c) => {
		const country = findCountries(c.areaEn)[0];
		const at = AREAS[c.areaEn.split(/\s+[–-]\s+/)[0].toLowerCase()]?.at ?? country?.center;
		if (!at) return [];
		return [{ id: `a-${c.id}`, layer: 'airspace' as const, lat: at[0], lon: at[1], r: 2.2, title: `Espacio aéreo: ${c.area}`, sub: `${c.id} · EASA`, url: c.url, country: country?.code }];
	});

/** Avisos a navegantes de seguridad (F21): un punto por aviso, en su primera coordenada. */
export const maritimePoints = (items: NavWarning[]): MapPoint[] =>
	items.flatMap((w) =>
		w.at && ok(w.at[0], w.at[1])
			? [{ id: `n-${w.id}`, layer: 'maritime' as const, lat: w.at[0], lon: w.at[1], r: 1.1, title: `${w.kind} · ${w.region}`, sub: `${w.id}${w.place ? ` · ${w.place}` : ''}`, url: 'https://msi.nga.mil/NavWarnings' }]
			: []
	);

/** Todas las capas a la vez. La usan GEO (+page.server.ts) y el JSON del mapa fijado en TOP. */
export const mapLayers = (d: {
	quakes?: Quake[];
	storms?: Storm[];
	events?: NaturalEvent[];
	straits?: Chokepoint[];
	sanctions?: TradeLike[];
	airspace?: Czib[];
	maritime?: NavWarning[];
}): Record<LayerId, MapPoint[]> => ({
	quakes: quakePoints(d.quakes ?? []),
	storms: stormPoints(d.storms ?? []),
	events: eventPoints(d.events ?? []),
	straits: straitPoints(d.straits ?? []),
	sanctions: sanctionPoints(d.sanctions ?? []),
	airspace: airspacePoints(d.airspace ?? []),
	maritime: maritimePoints(d.maritime ?? [])
});
