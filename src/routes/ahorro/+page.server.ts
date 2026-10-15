import { moneyRow, tenorSeries, type MoneyRow } from '#lib/btmm.ts';
import type { CestaData } from '#lib/cesta.ts';
import { dataset } from '#lib/data.ts';
import { seriesMap } from '#lib/series.ts';
import type { SeriesData, YieldCurveData } from '#lib/types.ts';
import type { PageServerLoad } from './$types';

// Tipos de hoy y el IPCA de España por grupos. Lo tuyo (cantidades, pesos de tu cesta) se queda en tu navegador.
export const load: PageServerLoad = async () => {
	const [ecb, bde, ea, cesta] = await Promise.all([
		dataset<SeriesData>('ecb'),
		dataset<SeriesData>('bde'),
		dataset<YieldCurveData>('eacurve'),
		dataset<CestaData>('cesta')
	]);
	const get = seriesMap(ecb, bde);
	const rows = [
		moneyRow(get('deposit-on-es'), 'Cuenta a la vista'),
		moneyRow(get('deposit-1y-es'), 'Depósito hasta 1 año'),
		moneyRow(get('estr'), '€STR (a un día)'),
		moneyRow(get('ecb-dfr'), 'Depósito en el BCE'),
		moneyRow(get('letras12-es-d'), 'Letras del Tesoro a 12 meses'),
		moneyRow(tenorSeries(ea?.data, '1A', 'ea1y', 'Deuda AAA a 1 año')),
		moneyRow(get('bond10-es-d') ?? get('bond10-es'), 'Bono España 10 años')
	].filter((r): r is MoneyRow => r !== null);
	return { rows, cesta: cesta?.data ?? null, cestaAt: cesta?.fetchedAt ?? null, ratesAt: ecb?.fetchedAt ?? null };
};
