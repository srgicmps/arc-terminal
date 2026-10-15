// Sala de control: todos los puntos del mapa con su hora y región (src/lib/exp/sala.ts) y el último minuto de
// geopolítica. Se calcula al construir; al navegador llegan los puntos ya hechos.
import { dataset } from '#lib/data.ts';
import { conflictPoints, electionPoints, fromGeo, gdacsPoints, outagePoints, travelPoints, type SalaPoint } from '#lib/exp/sala.ts';
import { eventPoints, quakePoints, stormPoints, straitPoints } from '#lib/geo/layers.ts';
import type { AdvisoriesData, Chokepoint, ElectionsData, GdacsEvent, HazardsData, IodaOutage, NewsData, Quake } from '#lib/types.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [geo, world, quakes, hazards, straits, advisories, elections, ioda, gdacs] = await Promise.all([
		dataset<NewsData>('news-geo'),
		dataset<NewsData>('news-world'),
		dataset<Quake[]>('quakes'),
		dataset<HazardsData>('hazards'),
		dataset<Chokepoint[]>('portwatch'),
		dataset<AdvisoriesData>('advisories'),
		dataset<ElectionsData>('elections'),
		dataset<IodaOutage[]>('ioda'),
		dataset<GdacsEvent[]>('gdacs')
	]);
	const now = Date.parse(geo?.fetchedAt ?? quakes?.fetchedAt ?? '') || 0;
	const news = [...(geo?.data.items ?? []), ...(world?.data.items ?? [])]
		.filter((n) => n.time)
		.sort((a, b) => b.time!.localeCompare(a.time!))
		.slice(0, 60);
	const quakeTimes = Object.fromEntries((quakes?.data ?? []).map((q) => [`q-${q.id}`, q.time]));

	const points: SalaPoint[] = [
		...conflictPoints(news),
		...fromGeo(quakePoints((quakes?.data ?? []).filter((q) => q.mag >= 4.5)), 'quakes', quakeTimes),
		...gdacsPoints(gdacs?.data),
		...fromGeo([...stormPoints(hazards?.data.storms ?? []), ...eventPoints(hazards?.data.events ?? [])], 'disasters'),
		...travelPoints(advisories?.data),
		...electionPoints(elections?.data.items, now),
		...outagePoints(ioda?.data),
		...fromGeo(straitPoints(straits?.data ?? []), 'straits')
	];

	return {
		fetchedAt: geo?.fetchedAt ?? null,
		points,
		latest: news.slice(0, 25).map((n) => ({ title: n.title, titleEs: n.titleEs, lang: n.lang, url: n.url, source: n.source, time: n.time }))
	};
};
