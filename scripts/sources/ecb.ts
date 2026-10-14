// Banco Central Europeo: ECB Data Portal API (sin clave). https://data.ecb.europa.eu/help/api/overview
// Reutilización libre citando la fuente.
import type { Series, SeriesData, YieldCurveData } from '../../src/lib/types.ts';
import { parseCsv } from '../csv.ts';
import { getText, num, settle, type Source } from '../lib.ts';

const API = 'https://data-api.ecb.europa.eu/service/data';

interface Wanted {
	/** Clave completa de la serie: FLUJO.DIMENSIONES */
	key: string;
	id: string;
	label: string;
	unit: string;
	geo?: string;
	last: number;
}

const WANTED: Wanted[] = [
	{ key: 'FM.B.U2.EUR.4F.KR.DFR.LEV', id: 'ecb-dfr', label: 'Facilidad de depósito', unit: '%', geo: 'EA', last: 500 },
	{ key: 'FM.B.U2.EUR.4F.KR.MRR_FR.LEV', id: 'ecb-mro', label: 'Operaciones principales de financiación', unit: '%', geo: 'EA', last: 500 },
	{ key: 'EST.B.EU000A2X2A25.WT', id: 'estr', label: '€STR', unit: '%', geo: 'EA', last: 90 },
	{ key: 'FM.M.U2.EUR.RT.MM.EURIBOR1YD_.HSTA', id: 'euribor-12m', label: 'Euríbor a 12 meses', unit: '%', geo: 'EA', last: 36 },
	{ key: 'MIR.M.ES.B.A2C.AM.R.A.2250.EUR.N', id: 'mortgage-es', label: 'Hipotecas nuevas', unit: '%', geo: 'ES', last: 36 },
	{ key: 'MIR.M.U2.B.A2C.AM.R.A.2250.EUR.N', id: 'mortgage-ea', label: 'Hipotecas nuevas', unit: '%', geo: 'EA', last: 36 },
	{ key: 'IRS.M.ES.L.L40.CI.0000.EUR.N.Z', id: 'bond10-es', label: 'Bono a 10 años', unit: '%', geo: 'ES', last: 36 },
	{ key: 'IRS.M.DE.L.L40.CI.0000.EUR.N.Z', id: 'bond10-de', label: 'Bono a 10 años', unit: '%', geo: 'DE', last: 36 },
	{ key: 'IRS.M.IT.L.L40.CI.0000.EUR.N.Z', id: 'bond10-it', label: 'Bono a 10 años', unit: '%', geo: 'IT', last: 36 },
	{ key: 'IRS.M.FR.L.L40.CI.0000.EUR.N.Z', id: 'bond10-fr', label: 'Bono a 10 años', unit: '%', geo: 'FR', last: 36 },
	{ key: 'IRS.M.PT.L.L40.CI.0000.EUR.N.Z', id: 'bond10-pt', label: 'Bono a 10 años', unit: '%', geo: 'PT', last: 36 },
	{ key: 'IRS.M.GR.L.L40.CI.0000.EUR.N.Z', id: 'bond10-gr', label: 'Bono a 10 años', unit: '%', geo: 'GR', last: 36 },
	// Balance del Eurosistema: total del activo, semanal, en millones de euros (estado financiero de cada martes).
	{ key: 'ILM.W.U2.C.T000000.Z5.Z01', id: 'ecb-balance', label: 'Balance del Eurosistema', unit: 'M€', geo: 'EA', last: 160 },
	{ key: 'EXR.D.USD.EUR.SP00.A', id: 'eurusd', label: 'EUR/USD', unit: '$', last: 275 },
	{ key: 'EXR.D.GBP.EUR.SP00.A', id: 'eurgbp', label: 'EUR/GBP', unit: '£', last: 275 },
	{ key: 'EXR.D.JPY.EUR.SP00.A', id: 'eurjpy', label: 'EUR/JPY', unit: '¥', last: 275 },
	{ key: 'EXR.D.CHF.EUR.SP00.A', id: 'eurchf', label: 'EUR/CHF', unit: 'CHF', last: 275 },
	{ key: 'EXR.D.CNY.EUR.SP00.A', id: 'eurcny', label: 'EUR/CNY', unit: '¥', last: 275 },
	{ key: 'EXR.D.MXN.EUR.SP00.A', id: 'eurmxn', label: 'EUR/MXN', unit: 'MXN', last: 275 }
];

async function series(w: Wanted): Promise<Series | null> {
	const [flow, ...dims] = w.key.split('.');
	const url = `${API}/${flow}/${dims.join('.')}?lastNObservations=${w.last}&format=csvdata&detail=dataonly`;
	const rows = parseCsv(await getText(url, { headers: { Accept: 'text/csv' } }));
	const points = rows
		.map((r) => ({ t: r.TIME_PERIOD, v: num(r.OBS_VALUE) }))
		.filter((p): p is { t: string; v: number } => Boolean(p.t) && p.v !== null)
		.sort((a, b) => a.t.localeCompare(b.t));
	if (!points.length) return null;
	return {
		id: w.id,
		label: w.label,
		unit: w.unit,
		geo: w.geo,
		points,
		source: 'BCE',
		url: `https://data.ecb.europa.eu/data/datasets/${flow}/${w.key}`
	};
}

export const ecb: Source<SeriesData> = {
	name: 'ecb',
	label: 'Tipos, euríbor, bonos y divisas · Banco Central Europeo',
	maxAgeMinutes: 175,
	// Si se añaden series a WANTED, la copia publicada no las tiene: se descarga de nuevo sin esperar.
	isStale: (previous) => WANTED.some((w) => !previous.series?.some((s) => s.id === w.id)),
	async fetch() {
		const found = await settle('ecb', WANTED, (w) => w.key, series);
		if (!found.length) throw new Error('ninguna serie del BCE');
		return { series: found };
	}
};

// Curva de tipos de la zona euro: bonos de los gobiernos de la zona con AAA, tipo al contado (Svensson).
// https://data.ecb.europa.eu/data/datasets/YC
const YC_TENORS: [string, string][] = [
	['SR_3M', '3M'],
	['SR_1Y', '1A'],
	['SR_2Y', '2A'],
	['SR_5Y', '5A'],
	['SR_10Y', '10A'],
	['SR_30Y', '30A']
];
const YC_KEY = 'B.U2.EUR.4F.G_N_A.SV_C_YM';

/** Pasa las filas del CSV del BCE (una por serie y día) a una fila por día con todos los plazos. */
export function curveDays(rows: Record<string, string>[], tenors: [string, string][]): YieldCurveData['days'] {
	const byDate = new Map<string, (number | null)[]>();
	for (const r of rows) {
		const i = tenors.findIndex(([key]) => key === r.DATA_TYPE_FM || r.KEY?.endsWith(`.${key}`));
		const v = num(r.OBS_VALUE);
		if (i < 0 || !r.TIME_PERIOD || v === null) continue;
		// El BCE da 10 decimales; con 3 sobra (las tablas enseñan 2) y el JSON pesa la mitad.
		const values = byDate.get(r.TIME_PERIOD) ?? tenors.map(() => null);
		values[i] = Math.round(v * 1000) / 1000;
		byDate.set(r.TIME_PERIOD, values);
	}
	return [...byDate]
		.map(([date, values]) => ({ date, values }))
		.sort((a, b) => a.date.localeCompare(b.date));
}

export const eacurve: Source<YieldCurveData> = {
	name: 'eacurve',
	label: 'Curva de tipos de la zona euro · BCE',
	// Una vez al día: el BCE la publica cada tarde con los datos del día hábil.
	maxAgeMinutes: 1435,
	async fetch() {
		const keys = YC_TENORS.map(([key]) => key).join('+');
		// ~13 meses de días hábiles: la curva de hoy y la de hace un año.
		const url = `${API}/YC/${YC_KEY}.${keys}?lastNObservations=290&format=csvdata&detail=dataonly`;
		const days = curveDays(parseCsv(await getText(url, { headers: { Accept: 'text/csv' } })), YC_TENORS);
		if (!days.length) throw new Error('curva vacía');
		return { tenors: YC_TENORS.map(([, label]) => label), days };
	}
};
