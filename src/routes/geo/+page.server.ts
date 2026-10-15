import { dataset } from '#lib/data.ts';
import { mapLayers } from '#lib/geo/layers.ts';
import type { ClimateData } from '#lib/climate.ts';
import { advisoryCountry, levelCounts, recentChanges } from '#lib/advisories.ts';
import type { MilexData } from '#lib/milex.ts';
import { riskSignals } from '#lib/risk-signals.ts';
import { mergeSanctions } from '#lib/sanctions.ts';
import { top } from '#lib/unhcr.ts';
import { headlines, trim } from '#lib/trim.ts';
import type {
	AdvisoriesData,
	Chokepoint,
	Disaster,
	ElectionsData,
	FoodInsecurity,
	EuLexDoc,
	GdacsEvent,
	HazardsData,
	IodaOutage,
	NewsData,
	OutbreakNews,
	PredictionsData,
	Quake,
	RadarData,
	SwpcData,
	TradeDoc,
	UnhcrData
} from '#lib/types.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [news, intl, analysis, world, quakes, hazards, predictions, portwatch, reliefweb, sanctions, climate, elections, swpc, advisories, sipri, gdacs, ioda, who, sanctionsUk, eurlex, unhcr, food, radar] = await Promise.all([
		dataset<NewsData>('news-geo'),
		dataset<NewsData>('news-intl'),
		dataset<NewsData>('news-analysis'),
		dataset<NewsData>('news-world'),
		dataset<Quake[]>('quakes'),
		dataset<HazardsData>('hazards'),
		dataset<PredictionsData>('predictions'),
		dataset<Chokepoint[]>('portwatch'),
		dataset<Disaster[]>('reliefweb'),
		dataset<TradeDoc[]>('sanctions'),
		dataset<ClimateData>('climate'),
		dataset<ElectionsData>('elections'),
		dataset<SwpcData>('swpc'),
		dataset<AdvisoriesData>('advisories'),
		dataset<MilexData>('sipri'),
		dataset<GdacsEvent[]>('gdacs'),
		dataset<IodaOutage[]>('ioda'),
		dataset<OutbreakNews[]>('who-don'),
		dataset<TradeDoc[]>('sanctions-uk'),
		dataset<EuLexDoc[]>('eurlex'),
		dataset<UnhcrData>('unhcr'),
		dataset<FoodInsecurity[]>('fewsnet'),
		dataset<RadarData>('radar')
	]);
	// Sanciones y aranceles: EE. UU. (Federal Register), Reino Unido (OFSI) y UE (actos de la serie L con el tema
	// «Sanciones»), juntos y de lo más reciente a lo más antiguo (M41).
	const trade = mergeSanctions(sanctions?.data, sanctionsUk?.data, eurlex?.data);
	// Los comunicados oficiales y los de organismos internacionales: solo los 15 que se pintan, sin resumen.
	// De Polymarket, los 8 mercados de geopolítica que se pintan (economía y tipos son de ECO).
	// Sanciones y aranceles: los 8 que se pintan. Tormentas solares: el aviso no pinta el Kp de 24 h.
	// Capas del mapa: se calculan aquí con los datos completos (las sanciones, antes de recortarlas a 8)
	// y a la página solo le llegan los puntos.
	const layers = mapLayers({
		quakes: quakes?.data,
		storms: hazards?.data.storms,
		events: hazards?.data.events,
		straits: portwatch?.data,
		sanctions: trade,
		crises: reliefweb?.data
	});
	return {
		layers,
		news,
		// Organismos y diplomacia salen del mismo canal: 40 titulares para que haya de los dos paneles.
		intl: headlines(intl, 40),
		analysis: headlines(analysis, 12),
		world: headlines(world, 20),
		quakes,
		hazards,
		predictions: trim(predictions, (d) => ({ geopolitics: d.geopolitics.slice(0, 8), economy: [] })),
		portwatch,
		reliefweb,
		sanctions: sanctions || sanctionsUk || eurlex
			? { fetchedAt: sanctions?.fetchedAt, ukAt: sanctionsUk?.fetchedAt, euAt: eurlex?.fetchedAt, data: trade.slice(0, 10) }
			: null,
		climate,
		elections,
		swpc: trim(swpc, (d) => ({ ...d, kp24: [] })),
		advisories: advisories && advisorySummary(advisories.data, Date.parse(advisories.fetchedAt), advisories.fetchedAt),
		// Señales de riesgo: solo las cifras y lo más grave de cada fuente, con la hora de cada descarga.
		signals:
			gdacs || ioda || radar || who
				? {
						...riskSignals(
							{ gdacs: gdacs?.data, ioda: ioda?.data, radar: radar?.data.outages, who: who?.data, advisories: advisories?.data },
							Date.now()
						),
						fetchedAt: { gdacs: gdacs?.fetchedAt, ioda: ioda?.fetchedAt, radar: radar?.fetchedAt, who: who?.fetchedAt }
					}
				: null,
		// Refugiados (ACNUR): los 8 países de los que más gente huye y los 8 que más acogen.
		refugees: unhcr && {
			fetchedAt: unhcr.fetchedAt,
			year: unhcr.data.year,
			from: top(unhcr.data, 'from', 8),
			hosted: top(unhcr.data, 'hosted', 8)
		},
		// Inseguridad alimentaria aguda (FEWS NET): los 10 países con más personas en fase IPC 3 o peor.
		food: trim(food, (d) => d.slice(0, 10)),
		// Gasto militar: los 15 países que más gastan.
		sipri: trim(sipri, (d) => ({ ...d, rows: d.rows.slice(0, 15) }))
	};
};

/** Avisos de viaje: el recuento por nivel y los cambios de los últimos 30 días, ya con el país en español. */
function advisorySummary(data: AdvisoriesData, now: number, fetchedAt: string) {
	return {
		fetchedAt,
		counts: levelCounts(data.items),
		rows: recentChanges(data.items, now).map((a) => {
			const c = advisoryCountry(a);
			return { name: c?.name ?? a.name, code: c?.code, level: a.level, prevLevel: a.prevLevel, date: a.changedAt ?? a.updated, url: a.url };
		})
	};
}
