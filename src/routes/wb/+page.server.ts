import { dataset } from '#lib/data.ts';
import type { YieldCurveData } from '#lib/types.ts';
import { wbRows } from '#lib/wb.ts';
import type { PageServerLoad } from './$types';

// La tabla se arma al construir: al navegador solo llegan tres filas, no las curvas enteras.
export const load: PageServerLoad = async () => {
	const [us, ea, jp] = await Promise.all([dataset<YieldCurveData>('uscurve'), dataset<YieldCurveData>('eacurve'), dataset<YieldCurveData>('jgb')]);
	return {
		rows: wbRows([
			{ code: 'US', name: 'EE. UU.', curve: us?.data },
			{ code: 'EA', name: 'Zona euro (AAA)', curve: ea?.data },
			{ code: 'JP', name: 'Japón', curve: jp?.data }
		]),
		fetchedAt: us?.fetchedAt
	};
};
