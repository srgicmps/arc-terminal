// GLOBO: los puntos de la Sala de control (conflictos, terremotos, catástrofes, viajes, elecciones, internet,
// espacio aéreo y estrechos) más los avisos a barcos y las sanciones de GEO. Al navegador solo llegan los puntos.
import { dataset } from '#lib/data.ts';
import type { NavWarnData } from '#lib/navwarn.ts';
import { salaData } from '#lib/exp/sala-data.ts';
import { maritimePoints, sanctionPoints } from '#lib/geo/layers.ts';
import type { GlobePoint } from '#lib/geo/globe.ts';
import { mergeSanctions } from '#lib/sanctions.ts';
import type { EuLexDoc, TradeDoc } from '#lib/types.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [sala, navwarn, sanctions, sanctionsUk, eurlex] = await Promise.all([
		salaData(),
		dataset<NavWarnData>('navwarn'),
		dataset<TradeDoc[]>('sanctions'),
		dataset<TradeDoc[]>('sanctions-uk'),
		dataset<EuLexDoc[]>('eurlex')
	]);
	const points: GlobePoint[] = [
		...sala.points.map(({ region: _r, ...p }) => p),
		...maritimePoints(navwarn?.data.items ?? []),
		...sanctionPoints(mergeSanctions(sanctions?.data, sanctionsUk?.data, eurlex?.data))
	];
	return { fetchedAt: sala.fetchedAt, points };
};
