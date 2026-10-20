import { dataset } from '#lib/data.ts';
import { curvePhrase, phrases } from '#lib/plain.ts';
import type { YieldCurveData } from '#lib/types.ts';
import { wbRows } from '#lib/wb.ts';
import type { PageServerLoad } from './$types';

// La tabla se arma al construir: al navegador solo llegan tres filas, no las curvas enteras.
export const load: PageServerLoad = async () => {
	const [us, ea, jp] = await Promise.all([dataset<YieldCurveData>('uscurve'), dataset<YieldCurveData>('eacurve'), dataset<YieldCurveData>('jgb')]);
	const rows = wbRows([
		{ code: 'US', name: 'EE. UU.', curve: us?.data },
		{ code: 'EA', name: 'Zona euro (AAA)', curve: ea?.data },
		{ code: 'JP', name: 'Japón', curve: jp?.data }
	]);
	const slope = (code: string) => rows.find((r) => r.code === code)?.s2s10;
	return {
		rows,
		// Modo Sencillo: la pendiente 2–10 de EE. UU. y de la zona euro, en frases (plain.ts). También al construir:
		// al navegador llegan las dos frases, no el código que las escribe.
		plain: phrases([curvePhrase('EE. UU.', slope('US')), curvePhrase('la zona euro', slope('EA'))]),
		fetchedAt: us?.fetchedAt
	};
};
