import { dataset } from '#lib/data.ts';
import type { FuelData, FuelSpainData } from '#lib/fuel.ts';
import { trim } from '#lib/trim.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [fuel, spain] = await Promise.all([dataset<FuelData>('fuel'), dataset<FuelSpainData>('fuel-es')]);
	// El historial de cada provincia no viaja con la vista: se pide al elegirla (data/fuel/history/<id>.json).
	const lite = trim(spain, (d) => ({ ...d, history: d.history?.map(({ date, avg }) => ({ date, avg })) }));
	return { fuel, spain: lite };
};
