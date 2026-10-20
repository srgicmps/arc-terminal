import { gap, moneyRow, tenorSeries, type MoneyRow } from '#lib/btmm.ts';
import { dataset } from '#lib/data.ts';
import { seriesMap } from '#lib/series.ts';
import type { SeriesData, YieldCurveData } from '#lib/types.ts';
import type { PageServerLoad } from './$types';

// Las filas se arman al construir: al navegador solo llega lo que se ve.
export const load: PageServerLoad = async () => {
	const [nyfed, fred, ecb, us, ea] = await Promise.all([
		dataset<SeriesData>('nyfed'),
		dataset<SeriesData>('fred'),
		dataset<SeriesData>('ecb'),
		dataset<YieldCurveData>('uscurve'),
		dataset<YieldCurveData>('eacurve')
	]);
	const get = seriesMap(nyfed, fred, ecb);
	const ok = (rows: (MoneyRow | null)[]) => rows.filter((r): r is MoneyRow => r !== null);
	// SOFR y EFFR: de la Fed de Nueva York; si falta, de FRED (con clave).
	const sofr = moneyRow(get('nyfed-sofr'), 'SOFR', get('nyfed-sofr-vol')) ?? moneyRow(get('sofr-us'), 'SOFR');
	const iorb = moneyRow(get('iorb-us'), 'Remuneración de las reservas (IORB)');
	const estr = moneyRow(get('estr'), '€STR');
	const dfr = moneyRow(get('ecb-dfr'), 'Facilidad de depósito del BCE');
	const usRows = ok([
		sofr,
		moneyRow(get('nyfed-tgcr'), 'TGCR (repo tripartito)', get('nyfed-tgcr-vol')),
		moneyRow(get('nyfed-bgcr'), 'BGCR (repo general)', get('nyfed-bgcr-vol')),
		moneyRow(get('nyfed-effr'), 'Fondos federales (EFFR)', get('nyfed-effr-vol')) ?? moneyRow(get('fedfunds-us'), 'Fondos federales (EFFR)'),
		moneyRow(get('nyfed-obfr'), 'Financiación a un día (OBFR)', get('nyfed-obfr-vol')),
		iorb,
		moneyRow(tenorSeries(us?.data, '1M', 'bill1m', 'Letra a 1 mes')),
		moneyRow(tenorSeries(us?.data, '3M', 'bill3m', 'Letra a 3 meses')),
		moneyRow(tenorSeries(us?.data, '6M', 'bill6m', 'Letra a 6 meses'))
	]);
	const eaRows = ok([
		dfr,
		estr,
		moneyRow(get('euribor-3m'), 'Euríbor a 3 meses'),
		moneyRow(get('euribor-12m'), 'Euríbor a 12 meses'),
		moneyRow(tenorSeries(ea?.data, '3M', 'ea3m', 'Curva AAA a 3 meses')),
		moneyRow(tenorSeries(ea?.data, '1A', 'ea1y', 'Curva AAA a 1 año'))
	]);
	return {
		usRows,
		eaRows,
		sofrIorb: gap(sofr, iorb),
		sofrEstr: gap(sofr, estr),
		// Para la frase del modo Sencillo: €STR frente a lo que paga el BCE (sale sin la clave de FRED, que trae IORB).
		estrDfr: gap(estr, dfr),
		fetchedAt: { us: nyfed?.fetchedAt ?? us?.fetchedAt, ea: ecb?.fetchedAt }
	};
};
