// COT (Commitments of Traders) de la CFTC: cómo están posicionados los especuladores (no comerciales) en futuros.
// Informe «legacy», solo futuros, vía la API Socrata de publicreporting.cftc.gov (sin clave). Datos del martes,
// publicados el viernes. Sin imports de Vite: lo usa también el script de Node.

/** Campo numérico del CFTC; vacío o ausente → NaN (la fila se descarta). */
const num = (v: unknown): number => (v === '' || v === null || v === undefined ? NaN : Number(v));

export interface CotMarket {
	code: string;
	name: string;
	/** Posición neta de los especuladores (largos − cortos), en contratos. */
	net: number;
	/** Neta frente al interés abierto, en %. */
	pctOi: number;
	/** Cambio de la neta en la semana, en contratos. */
	change: number;
	/** Dónde está la neta dentro del rango de las últimas 52 semanas: 0 = mínimo, 100 = máximo. Null con poca historia. */
	range: number | null;
}

export interface CotData {
	/** Fecha del informe (martes): «2026-10-06». */
	date: string;
	markets: CotMarket[];
}

/** Mercados que se siguen, por código de contrato de la CFTC, en el orden del panel. */
export const COT_MARKETS: { code: string; name: string }[] = [
	{ code: '13874A', name: 'S&P 500 (E-mini)' },
	{ code: '043602', name: 'Bono a 10 años de EE. UU.' },
	{ code: '099741', name: 'Euro' },
	{ code: '097741', name: 'Yen' },
	{ code: '088691', name: 'Oro' },
	{ code: '067651', name: 'Petróleo WTI' },
	{ code: '133741', name: 'Bitcoin (CME)' }
];

export const COT_URL = 'https://publicreporting.cftc.gov/resource/6dca-aqww.json';
export const COT_PAGE = 'https://www.cftc.gov/MarketReports/CommitmentsofTraders/index.htm';

/** Una fila de la API (todo llega como texto). */
export interface CotRow {
	report_date_as_yyyy_mm_dd: string;
	cftc_contract_market_code: string;
	open_interest_all: string;
	noncomm_positions_long_all: string;
	noncomm_positions_short_all: string;
}

/** Calcula cada mercado con sus filas (cualquier orden). Se salta los mercados sin datos del último informe. */
export function parseCot(rows: CotRow[]): CotData | null {
	const date = rows.map((r) => r.report_date_as_yyyy_mm_dd.slice(0, 10)).sort().at(-1);
	if (!date) return null;
	const markets = COT_MARKETS.flatMap(({ code, name }) => {
		const hist = rows
			.filter((r) => r.cftc_contract_market_code === code)
			.map((r) => ({
				t: r.report_date_as_yyyy_mm_dd.slice(0, 10),
				// Number('') es 0: un campo vacío daría una neta igual a los largos.
				net: num(r.noncomm_positions_long_all) - num(r.noncomm_positions_short_all),
				oi: num(r.open_interest_all)
			}))
			.filter((h) => Number.isFinite(h.net) && h.oi > 0)
			.sort((a, b) => a.t.localeCompare(b.t))
			.slice(-52);
		const last = hist.at(-1);
		if (!last || last.t !== date) return [];
		const prev = hist.at(-2);
		const nets = hist.map((h) => h.net);
		const lo = Math.min(...nets);
		const hi = Math.max(...nets);
		const range = hist.length >= 26 && hi > lo ? Math.round(((last.net - lo) / (hi - lo)) * 100) : null;
		return [
			{
				code,
				name,
				net: last.net,
				pctOi: Math.round((last.net / last.oi) * 1000) / 10,
				change: prev ? last.net - prev.net : 0,
				range
			}
		];
	});
	return markets.length ? { date, markets } : null;
}
