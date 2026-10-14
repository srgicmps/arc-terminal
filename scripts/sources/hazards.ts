// Riesgos naturales: terremotos en España (IGN), huracanes activos (NOAA) y eventos naturales abiertos
// (incendios, volcanes, tormentas) de la NASA. Todo sin clave y de dominio público.
import type { HazardsData, NaturalEvent, Quake, Storm } from '../../src/lib/types.ts';
import { getJson, getText, list, num, plain, tidy, type Source } from '../lib.ts';
import { parseFeed } from './news.ts';

type Raw = Record<string, any>;

// ---------- IGN: terremotos de los últimos 10 días en España y alrededores ----------

export const quakesEs: Source<Quake[]> = {
	name: 'quakes-es',
	label: 'Terremotos en España · Instituto Geográfico Nacional',
	maxAgeMinutes: 12,
	// Cuántos terremotos hay depende de la actividad sísmica: tras un enjambre, el número cae de golpe.
	allowEmpty: true,
	async fetch() {
		const items = parseFeed(await getText('https://www.ign.es/ign/RssTools/sismologia.xml'), 'IGN');
		// «Se ha producido un terremoto de magnitud 2.7 en SW CABO DE SAN VICENTE en la fecha
		//  13/10/2026 19:26:33 en la siguiente localización: 36.8518,-10.6319»
		const re = /magnitud\s+([\d.,]+)\s+en\s+(.+?)\s+en la fecha\s+(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}:\d{2}:\d{2}).*?([-\d.]+),\s*([-\d.]+)/i;
		const quakes = items.flatMap((item) => {
			const m = item.summary.match(re);
			if (!m) return [];
			const [, mag, place, d, mo, y, time, lat, lon] = m;
			return [
				{
					id: item.url,
					mag: num(mag) ?? 0,
					place: tidy(plain(place)),
					// El IGN da la hora sin zona; su catálogo usa hora UTC.
					time: item.time ?? new Date(`${y}-${mo}-${d}T${time}Z`).toISOString(),
					url: item.url,
					tsunami: false,
					alert: null,
					lat: Number(lat),
					lon: Number(lon),
					depth: NaN
				}
			];
		});
		if (!quakes.length && items.length) throw new Error('no se entiende el formato del IGN');
		return quakes.sort((a, b) => b.time.localeCompare(a.time));
	}
};

// ---------- NOAA y NASA ----------

export const hazards: Source<HazardsData> = {
	name: 'hazards',
	label: 'Huracanes (NOAA) y eventos naturales: incendios, volcanes, tormentas (NASA EONET)',
	maxAgeMinutes: 25,
	// Fuera de la temporada de huracanes y sin desastres activos, las dos listas pueden venir vacías.
	allowEmpty: true,
	async fetch() {
		const [nhc, eonet] = await Promise.all([
			getJson<Raw>('https://www.nhc.noaa.gov/CurrentStorms.json').catch(() => null),
			getJson<Raw>('https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=20&limit=80').catch(() => null)
		]);
		if (!nhc && !eonet) throw new Error('ni NOAA ni EONET responden');

		const storms: Storm[] = list<Raw>(nhc?.activeStorms).map((s) => ({
			id: String(s.id),
			name: plain(s.name),
			classification: String(s.classification ?? ''),
			knots: Number(s.intensity),
			pressure: Number(s.pressure),
			lat: Number(s.latitudeNumeric),
			lon: Number(s.longitudeNumeric),
			updated: String(s.lastUpdate ?? ''),
			url: String(s.publicAdvisory?.url ?? 'https://www.nhc.noaa.gov/')
		}));

		const events: NaturalEvent[] = list<Raw>(eonet?.events)
			.map((e) => {
				const g = list<Raw>(e.geometry).at(-1) ?? {};
				const coords = Array.isArray(g.coordinates?.[0]) ? g.coordinates[0][0] ?? [] : g.coordinates ?? [];
				return {
					id: String(e.id),
					title: plain(e.title),
					category: String(list<Raw>(e.categories)[0]?.title ?? ''),
					date: String(g.date ?? ''),
					url: String(list<Raw>(e.sources)[0]?.url ?? e.link ?? ''),
					lon: Number(coords[0]),
					lat: Number(coords[1]),
					magnitude: g.magnitudeValue ? `${g.magnitudeValue} ${g.magnitudeUnit ?? ''}`.trim() : ''
				};
			})
			.sort((a, b) => b.date.localeCompare(a.date));

		return { storms, events };
	}
};
