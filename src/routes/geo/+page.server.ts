import { dataset } from '#lib/data.ts';
import { crisisPoints, eventPoints, quakePoints, sanctionPoints, stormPoints, straitPoints, type LayerId, type MapPoint } from '#lib/geo/layers.ts';
import type { ClimateData } from '#lib/climate.ts';
import { headlines, trim } from '#lib/trim.ts';
import type { Chokepoint, Disaster, HazardsData, NewsData, PredictionsData, Quake, TradeDoc } from '#lib/types.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [news, gov, intl, quakes, quakesEs, hazards, predictions, portwatch, reliefweb, sanctions, climate] = await Promise.all([
		dataset<NewsData>('news-geo'),
		dataset<NewsData>('news-gov'),
		dataset<NewsData>('news-intl'),
		dataset<Quake[]>('quakes'),
		dataset<Quake[]>('quakes-es'),
		dataset<HazardsData>('hazards'),
		dataset<PredictionsData>('predictions'),
		dataset<Chokepoint[]>('portwatch'),
		dataset<Disaster[]>('reliefweb'),
		dataset<TradeDoc[]>('sanctions'),
		dataset<ClimateData>('climate')
	]);
	// Los comunicados oficiales y los de organismos internacionales: solo los 15 que se pintan, sin resumen.
	// De Polymarket, los 8 mercados de geopolítica que se pintan (economía y tipos son de ECO).
	// Sanciones y aranceles: los 8 que se pintan.
	// Capas del mapa: se calculan aquí con los datos completos (las sanciones, antes de recortarlas a 8)
	// y a la página solo le llegan los puntos.
	const layers: Record<LayerId, MapPoint[]> = {
		quakes: quakePoints(quakes?.data ?? []),
		storms: stormPoints(hazards?.data.storms ?? []),
		events: eventPoints(hazards?.data.events ?? []),
		straits: straitPoints(portwatch?.data ?? []),
		sanctions: sanctionPoints(sanctions?.data ?? []),
		crises: crisisPoints(reliefweb?.data ?? [])
	};
	return {
		layers,
		news,
		gov: headlines(gov, 15),
		intl: headlines(intl, 15),
		quakes,
		quakesEs,
		hazards,
		predictions: trim(predictions, (d) => ({ geopolitics: d.geopolitics.slice(0, 8), economy: [] })),
		portwatch,
		reliefweb,
		sanctions: trim(sanctions, (d) => d.slice(0, 8)),
		climate
	};
};
