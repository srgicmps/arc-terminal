// Cabina: las cifras del día, el termómetro de riesgo y el semáforo ya calculados, y el precio de la luz por horas
// (la hora de ahora se busca en el navegador).
import { dataset } from '#lib/data.ts';
import { loadFigures } from '#lib/exp/load.ts';
import { hourly } from '#lib/power.ts';
import { computeRisk } from '#lib/risk.ts';
import { riskLights } from '#lib/risk-lights.ts';
import { seriesMap } from '#lib/series.ts';
import type { CryptoData, PowerData, PredictionsData, SeriesData, VixData } from '#lib/types.ts';
import type { UncertaintyData } from '#lib/uncertainty.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [figures, fred, ecb, crypto, predictions, vix, uncertainty, power] = await Promise.all([
		loadFigures(),
		dataset<SeriesData>('fred'),
		dataset<SeriesData>('ecb'),
		dataset<CryptoData>('crypto'),
		dataset<PredictionsData>('predictions'),
		dataset<VixData>('vix'),
		dataset<UncertaintyData>('uncertainty'),
		dataset<PowerData>('power')
	]);
	const risk = computeRisk({ fred: fred?.data, ecb: ecb?.data, crypto: crypto?.data, predictions: predictions?.data });
	return {
		fetchedAt: fred?.fetchedAt ?? ecb?.fetchedAt ?? null,
		figures,
		risk: risk.parts.length ? risk.score : null,
		lights: riskLights({ get: seriesMap(ecb, fred, uncertainty), vix: vix?.data }),
		pvpc: hourly(power?.data.pvpc ?? [])
	};
};
