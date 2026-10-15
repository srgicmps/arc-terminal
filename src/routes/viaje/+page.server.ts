import { dataset } from '#lib/data.ts';
import { trim } from '#lib/trim.ts';
import type { AdvisoriesData, SeriesData } from '#lib/types.ts';
import type { PageServerLoad } from './$types';

// VIAJE (F5): la ciudad se elige en el navegador (?ciudad=Tokio). Aquí solo viajan los tipos de cambio del BCE
// (último dato de cada «eurXXX») y los avisos de viaje; el tiempo y los festivos se piden desde el navegador.
export const load: PageServerLoad = async () => {
	const [ecb, advisories] = await Promise.all([dataset<SeriesData>('ecb'), dataset<AdvisoriesData>('advisories')]);
	return {
		fx: trim(ecb, (d) => ({ series: d.series.filter((s) => /^eur[a-z]{3}$/.test(s.id)).map((s) => ({ ...s, points: s.points.slice(-1) })) })),
		advisories
	};
};
