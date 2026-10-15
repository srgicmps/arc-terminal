// El mapa de GEO fijado en TOP: solo los puntos de las capas, no los datos completos de cada fuente.
// Se genera al construir la web (prerender), así que se renueva con cada publicación, igual que GEO.
import { json } from '@sveltejs/kit';
import { dataset } from '#lib/data.ts';
import { mapLayers } from '#lib/geo/layers.ts';
import { mergeSanctions } from '#lib/sanctions.ts';
import type { CzibData } from '#lib/czib.ts';
import type { NavWarnData } from '#lib/navwarn.ts';
import type { Chokepoint, EuLexDoc, HazardsData, Quake, TradeDoc } from '#lib/types.ts';

export const prerender = true;

export async function GET() {
	const sets = await Promise.all([
		dataset<Quake[]>('quakes'),
		dataset<HazardsData>('hazards'),
		dataset<Chokepoint[]>('portwatch'),
		dataset<TradeDoc[]>('sanctions'),
		dataset<TradeDoc[]>('sanctions-uk'),
		dataset<EuLexDoc[]>('eurlex'),
		dataset<CzibData>('czib'),
		dataset<NavWarnData>('navwarn')
	]);
	const [quakes, hazards, portwatch, sanctions, sanctionsUk, eurlex, czib, navwarn] = sets;
	const fetchedAt = sets.map((s) => s?.fetchedAt ?? '').sort().at(-1) ?? '';
	const data = mapLayers({
		quakes: quakes?.data,
		storms: hazards?.data.storms,
		events: hazards?.data.events,
		straits: portwatch?.data,
		// Igual que GEO: sanciones de EE. UU., Reino Unido y UE juntas.
		sanctions: mergeSanctions(sanctions?.data, sanctionsUk?.data, eurlex?.data),
		airspace: czib?.data.items,
		maritime: navwarn?.data.items
	});
	return json({ name: 'pin/geo-mapa', fetchedAt, data });
}
