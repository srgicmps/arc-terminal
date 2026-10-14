// El mapa de GEO fijado en TOP: solo los puntos de las capas, no los datos completos de cada fuente.
// Se genera al construir la web (prerender), así que se renueva con cada publicación, igual que GEO.
import { json } from '@sveltejs/kit';
import { dataset } from '#lib/data.ts';
import { mapLayers } from '#lib/geo/layers.ts';
import type { Chokepoint, Disaster, HazardsData, Quake, TradeDoc } from '#lib/types.ts';

export const prerender = true;

export async function GET() {
	const sets = await Promise.all([
		dataset<Quake[]>('quakes'),
		dataset<HazardsData>('hazards'),
		dataset<Chokepoint[]>('portwatch'),
		dataset<TradeDoc[]>('sanctions'),
		dataset<Disaster[]>('reliefweb')
	]);
	const [quakes, hazards, portwatch, sanctions, reliefweb] = sets;
	const fetchedAt = sets.map((s) => s?.fetchedAt ?? '').sort().at(-1) ?? '';
	const data = mapLayers({
		quakes: quakes?.data,
		storms: hazards?.data.storms,
		events: hazards?.data.events,
		straits: portwatch?.data,
		sanctions: sanctions?.data,
		crises: reliefweb?.data
	});
	return json({ name: 'pin/geo-mapa', fetchedAt, data });
}
