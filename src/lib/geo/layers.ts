// Capas del mapa de GEO: convierte cada conjunto de datos en puntos con la misma forma, para que
// WorldMap solo tenga que dibujarlos. Funciones puras, con tests.
import { nf } from '../format.ts';
import type { Chokepoint, Disaster, NaturalEvent, Quake, Storm } from '../types.ts';

/** Lo que hace falta de un documento de sanciones o aranceles (sanctions.json). */
export interface TradeLike {
	title: string;
	abstract: string;
	url: string;
}

export type LayerId = 'quakes' | 'storms' | 'events' | 'straits' | 'sanctions' | 'crises';

export const LAYERS: { value: LayerId; label: string }[] = [
	{ value: 'quakes', label: 'Terremotos' },
	{ value: 'storms', label: 'Ciclones' },
	{ value: 'events', label: 'Incendios y volcanes' },
	{ value: 'straits', label: 'Estrechos' },
	{ value: 'sanctions', label: 'Sanciones' },
	{ value: 'crises', label: 'Crisis' }
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
 * Centro aproximado de los países que más salen en sanciones, aranceles y crisis, con los nombres en
 * inglés (como vienen en el Federal Register y en ReliefWeb) y sus gentilicios.
 */
export const COUNTRIES: { name: string; match: RegExp; at: [number, number] }[] = [
	{ name: 'Rusia', match: /\b(Russia|Russian)\b/i, at: [61.5, 99] },
	{ name: 'Irán', match: /\b(Iran|Iranian)\b/i, at: [32.4, 53.7] },
	{ name: 'Corea del Norte', match: /\b(North Korea|DPRK|Democratic People's Republic of Korea)\b/i, at: [40.3, 127.5] },
	{ name: 'China', match: /\b(China|Chinese|PRC)\b/i, at: [35.9, 104.2] },
	{ name: 'Venezuela', match: /\b(Venezuela|Venezuelan)\b/i, at: [6.4, -66.6] },
	{ name: 'Cuba', match: /\b(Cuba|Cuban)\b/i, at: [21.5, -77.8] },
	{ name: 'Siria', match: /\b(Syria|Syrian)\b/i, at: [34.8, 38.9] },
	{ name: 'Bielorrusia', match: /\b(Belarus|Belarusian)\b/i, at: [53.7, 27.9] },
	{ name: 'Birmania', match: /\b(Burma|Myanmar|Burmese)\b/i, at: [21.9, 95.9] },
	{ name: 'Afganistán', match: /\b(Afghanistan|Afghan)\b/i, at: [33.9, 67.7] },
	{ name: 'Irak', match: /\b(Iraq|Iraqi)\b/i, at: [33.2, 43.7] },
	{ name: 'Líbano', match: /\b(Lebanon|Lebanese|Hizballah|Hezbollah)\b/i, at: [33.9, 35.9] },
	{ name: 'Yemen', match: /\b(Yemen|Yemeni|Houthis?)\b/i, at: [15.6, 48.5] },
	{ name: 'Sudán', match: /\b(?<!South )(Sudan|Sudanese)\b/i, at: [12.9, 30.2] },
	{ name: 'Sudán del Sur', match: /\bSouth Sudan\b/i, at: [6.9, 31.3] },
	{ name: 'Libia', match: /\b(Libya|Libyan)\b/i, at: [26.3, 17.2] },
	{ name: 'Somalia', match: /\b(Somalia|Somali|al-Shabaab)\b/i, at: [5.2, 46.2] },
	{ name: 'Mali', match: /\bMali\b/, at: [17.6, -4] },
	{ name: 'R. D. del Congo', match: /\b(Democratic Republic of the Congo|DRC)\b/i, at: [-4, 21.8] },
	{ name: 'Etiopía', match: /\b(Ethiopia|Ethiopian)\b/i, at: [9.1, 40.5] },
	{ name: 'Haití', match: /\b(Haiti|Haitian)\b/i, at: [18.9, -72.3] },
	{ name: 'Nicaragua', match: /\bNicaragua\b/i, at: [12.9, -85.2] },
	{ name: 'México', match: /\b(Mexico|Mexican)\b/i, at: [23.6, -102.6] },
	{ name: 'Colombia', match: /\b(Colombia|Colombian)\b/i, at: [4.6, -74.3] },
	{ name: 'Ucrania', match: /\b(Ukraine|Ukrainian)\b/i, at: [48.4, 31.2] },
	{ name: 'Turquía', match: /\b(Turkey|Türkiye|Turkish)\b/i, at: [39, 35.2] },
	{ name: 'India', match: /\b(India|Indian)\b/i, at: [20.6, 79] },
	{ name: 'Japón', match: /\b(Japan|Japanese)\b/i, at: [36.2, 138.3] },
	{ name: 'Canadá', match: /\b(Canada|Canadian)\b/i, at: [56.1, -106.3] },
	{ name: 'Brasil', match: /\b(Brazil|Brazilian)\b/i, at: [-14.2, -51.9] },
	{ name: 'Unión Europea', match: /\b(European Union|EU)\b/, at: [50.1, 9.7] },
	{ name: 'Filipinas', match: /\b(Philippines|Philippine)\b/i, at: [12.9, 121.8] },
	{ name: 'Pakistán', match: /\b(Pakistan|Pakistani)\b/i, at: [30.4, 69.3] },
	{ name: 'Bangladés', match: /\bBangladesh\b/i, at: [23.7, 90.4] },
	{ name: 'Nigeria', match: /\b(Nigeria|Nigerian)\b/i, at: [9.1, 8.7] },
	{ name: 'Mozambique', match: /\bMozambique\b/i, at: [-18.7, 35.5] },
	{ name: 'Indonesia', match: /\b(Indonesia|Indonesian)\b/i, at: [-0.8, 113.9] }
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

/** Países que nombra un texto. */
export const countriesIn = (text: string) => COUNTRIES.filter((c) => c.match.test(text));

/** Sanciones y aranceles agrupados por país: un punto por país, más grande cuantos más documentos. */
export function sanctionPoints(docs: TradeLike[]): MapPoint[] {
	const by = new Map<string, { at: [number, number]; docs: TradeLike[] }>();
	for (const d of docs) {
		for (const c of countriesIn(`${d.title} ${d.abstract}`)) {
			const entry = by.get(c.name) ?? { at: c.at, docs: [] };
			entry.docs.push(d);
			by.set(c.name, entry);
		}
	}
	return [...by.entries()].map(([name, { at, docs }]) => ({
		id: `x-${name}`,
		layer: 'sanctions',
		lat: at[0],
		lon: at[1],
		r: 1.2 + Math.min(2.4, docs.length * 0.6),
		strong: docs.length >= 3,
		title: `${name}: ${docs.length} ${docs.length === 1 ? 'documento' : 'documentos'}`,
		sub: docs[0].title,
		url: docs[0].url
	}));
}

/** Crisis de ReliefWeb, en el centro de su país (si el país está en la tabla). */
export const crisisPoints = (items: Disaster[]): MapPoint[] =>
	items.flatMap((d) => {
		const c = countriesIn(d.country)[0];
		if (!c) return [];
		return [{ id: `r-${d.id}`, layer: 'crises' as const, lat: c.at[0], lon: c.at[1], r: 1.6, title: d.name, sub: d.type, url: d.url }];
	});
