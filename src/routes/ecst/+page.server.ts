import { dataset } from '#lib/data.ts';
import { ecstRows } from '#lib/ecst.ts';
import type { ImfData, SeriesData, YieldCurveData } from '#lib/types.ts';
import type { PageServerLoad } from './$types';

// La tabla se arma aquí, al construir: al navegador solo llegan las filas, no las series ni las curvas enteras.
export const load: PageServerLoad = async () => {
	const [imf, bis, ecb, us, jp] = await Promise.all([
		dataset<ImfData>('imf'),
		dataset<SeriesData>('bis'),
		dataset<SeriesData>('ecb'),
		dataset<YieldCurveData>('uscurve'),
		dataset<YieldCurveData>('jgb')
	]);
	const series = [...(bis?.data.series ?? []), ...(ecb?.data.series ?? [])];
	return {
		rows: ecstRows(imf?.data.g20 ?? [], series, { us: us?.data, jp: jp?.data }),
		edition: imf?.data.edition ?? null,
		year: imf?.data.years[0] ?? null,
		fetchedAt: imf?.fetchedAt
	};
};
