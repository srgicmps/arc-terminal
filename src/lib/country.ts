// Ficha de un país (PAIS): junta lo que ya traen las fuentes (Eurostat, BLS, FRED, BCE, BIS, Tesoro de
// EE. UU. y FMI) para un país de src/lib/countries.ts. Si un dato no existe para ese país, no aparece:
// la vista enseña solo los bloques que tienen algo.
import type { Country } from './countries.ts';
import { at, last, spread } from './series.ts';
import type { ImfData, ImfRow, Point, Series, YieldCurveData } from './types.ts';

/** Una cifra de la tira de arriba: PIB, inflación, paro o deuda. */
export interface Kpi {
	key: 'gdp' | 'cpi' | 'unemployment' | 'debt';
	label: string;
	value: number;
	unit: string;
	/** Periodo del dato: «2026-09», «2026-Q2». */
	t: string;
	/** Valor del periodo anterior, para la variación. */
	prev: number | null;
	source: string;
}

/** Un tipo con su fecha y el valor anterior: tipo oficial, bono a 10 años o prima de riesgo. */
export interface Rate {
	label: string;
	value: number;
	unit: string;
	/** Periodo del dato (para el tipo oficial, el mes del último cambio). */
	t: string;
	prev: number | null;
	source: string;
	url?: string;
}

/** Un cambio de divisas: «EUR/GBP 0,8612». */
export interface FxRow {
	pair: string;
	value: number;
	/** Variación en un mes, en %. */
	month: number | null;
	date: string;
}

export interface CountryProfile {
	kpis: Kpi[];
	policy: Rate | null;
	bond: Rate | null;
	/** Prima de riesgo frente al bono alemán, en puntos básicos (solo países del euro). */
	premium: Rate | null;
	fx: FxRow[];
	/** Previsiones del FMI: el país y, para comparar, la zona euro (si es del euro) y el mundo. */
	imf: { edition: string | null; years: [number, number]; rows: ImfRow[] } | null;
	/** Deuda y saldo públicos del FMI (% del PIB, año en curso), con su puesto entre los del G20 y España. */
	fiscal: { year: number; debt: number | null; balance: number | null; debtRank: number | null; of: number } | null;
}

type Get = (id: string) => Series | undefined;

/** Primer candidato que existe y cumple `ok`. */
function pick(get: Get, ids: string[], ok: (s: Series) => boolean = () => true): Series | undefined {
	for (const id of ids) {
		const s = get(id);
		if (s?.points.length && ok(s)) return s;
	}
	return undefined;
}

const prevOf = (s: Series): number | null => s.points.at(-2)?.v ?? null;

// Las series de todas las fuentes siguen el patrón «<indicador>-<país>»: gdp-es (Eurostat), gdp-us (FRED),
// unemployment-us (BLS)… Para cada cifra, las series que sirven, por orden de preferencia.
const KPIS: { key: Kpi['key']; label: string; ids: (lc: string) => string[]; ok?: (s: Series) => boolean }[] = [
	{ key: 'gdp', label: 'PIB', ids: (lc) => [`gdp-${lc}`] },
	{ key: 'cpi', label: 'IPC', ids: (lc) => [`inflation-${lc}`, `cpi-${lc}`] },
	{ key: 'unemployment', label: 'Paro', ids: (lc) => [`unemployment-${lc}`] },
	// «debt-us» del Tesoro es la deuda en dólares, no en % del PIB: solo vale la de Eurostat.
	{ key: 'debt', label: 'Deuda / PIB', ids: (lc) => [`debt-${lc}`], ok: (s) => s.unit.startsWith('%') }
];

export function kpis(c: Country, get: Get): Kpi[] {
	const lc = c.code.toLowerCase();
	return KPIS.flatMap(({ key, label, ids, ok }) => {
		const s = pick(get, ids(lc), ok);
		const p = s && last(s);
		if (!s || !p) return [];
		return [{ key, label, value: p.v, unit: s.unit, t: p.t, prev: prevOf(s), source: s.source }];
	});
}

/** Tipo oficial del banco central (BIS): el del país o, si es del euro, el del BCE. */
export function policyRate(c: Country, series: Series[]): Rate | null {
	const geo = c.euro ? 'EA' : c.code;
	const s = series.find((x) => x.id.startsWith('policy-') && x.geo === geo);
	const p = last(s);
	if (!s || !p) return null;
	return { label: s.label, value: p.v, unit: s.unit, t: p.t, prev: prevOf(s), source: s.source, url: s.url };
}

/** Bono a 10 años: el del BCE para los países del euro y la curva del Tesoro para EE. UU. */
export function bond10(c: Country, get: Get, curve: YieldCurveData | null): Rate | null {
	const s = get(`bond10-${c.code.toLowerCase()}`);
	const p = last(s);
	if (s && p) return { label: 'Bono a 10 años', value: p.v, unit: s.unit, t: p.t, prev: prevOf(s), source: s.source, url: s.url };
	if (c.code !== 'US' || !curve) return null;
	const i = curve.tenors.indexOf('10A');
	const days = curve.days.filter((d) => typeof d.values[i] === 'number');
	const today = days.at(-1);
	if (i < 0 || !today) return null;
	// Para comparar, el primer día de la curva (un mes antes, más o menos), como en la tabla mensual del BCE.
	const before = days.length > 1 ? days[0] : undefined;
	return {
		label: 'Bono a 10 años',
		value: today.values[i]!,
		unit: '%',
		t: today.date,
		prev: before?.values[i] ?? null,
		source: 'Tesoro de EE. UU.',
		url: 'https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_yield_curve'
	};
}

/** Prima de riesgo frente a Alemania, en puntos básicos. Solo para los países del euro que no son Alemania. */
export function premium(c: Country, get: Get): Rate | null {
	if (!c.euro || c.code === 'DE') return null;
	const s = spread(get(`bond10-${c.code.toLowerCase()}`), get('bond10-de'), `premium-${c.code}`, 'Prima de riesgo');
	const p = last(s);
	if (!s || !p) return null;
	return { label: 'Prima frente a Alemania', value: p.v, unit: 'pb', t: p.t, prev: prevOf(s), source: s.source, url: s.url };
}

/** Día de hace un mes: «2026-10-14» → «2026-09-14». */
function monthBefore(date: string): string {
	const d = new Date(`${date}T12:00:00Z`);
	d.setUTCMonth(d.getUTCMonth() - 1);
	return d.toISOString().slice(0, 10);
}

/**
 * Cambio de la moneda del país frente al euro y al dólar, con los tipos de referencia del BCE (series
 * «eurusd», «eurgbp»…: unidades por euro). Frente al dólar se cruzan: USD/GBP = EUR/GBP ÷ EUR/USD.
 * Países del euro: EUR/USD. Una moneda que el BCE no publica aquí (el real, la rupia…) no sale.
 */
export function fxRows(c: Country, get: Get): FxRow[] {
	const usd = get('eurusd');
	const own = c.currency === 'EUR' || c.currency === 'USD' ? undefined : get(`eur${c.currency.toLowerCase()}`);
	const row = (pair: string, now: Point | undefined, then: Point | undefined): FxRow[] =>
		now ? [{ pair, value: now.v, month: then?.v ? ((now.v - then.v) / then.v) * 100 : null, date: now.t }] : [];

	if (c.currency === 'EUR' || c.currency === 'USD') {
		const p = last(usd);
		return p ? row('EUR/USD', p, at(usd, monthBefore(p.t))) : [];
	}
	const p = last(own);
	if (!own || !p) return [];
	const out = row(`EUR/${c.currency}`, p, at(own, monthBefore(p.t)));
	// El cruce con el dólar, con los dos tipos del mismo día.
	const cross = (t: string): Point | undefined => {
		const a = at(own, t);
		const b = at(usd, t);
		return a && b && b.v ? { t: a.t, v: a.v / b.v } : undefined;
	};
	out.push(...row(`USD/${c.currency}`, cross(p.t), cross(monthBefore(p.t))));
	return out;
}

/** Previsiones del FMI: la fila del país, y la zona euro y el mundo para comparar. Sin fila del país, nada. */
export function imfRows(c: Country, imf: ImfData | null): CountryProfile['imf'] {
	const own = imf?.rows.find((r) => r.code === c.iso3);
	if (!imf || !own) return null;
	const extra = [...(c.euro ? ['EURO'] : []), 'WEOWORLD'];
	const rows = [own, ...extra.flatMap((code) => imf.rows.filter((r) => r.code === code))];
	return { edition: imf.edition, years: imf.years, rows };
}

/** Deuda y saldo públicos (FMI, ImfData.g20); el puesto 1 es la deuda más alta. Sin fila del país, nada. */
export function imfFiscal(c: Country, imf: ImfData | null): CountryProfile['fiscal'] {
	const all = imf?.g20 ?? [];
	const own = all.find((r) => r.code === c.iso3);
	if (!imf || !own || (own.debt === null && own.balance === null)) return null;
	const ranked = all.filter((r) => r.debt !== null).sort((a, b) => b.debt! - a.debt!);
	const i = ranked.findIndex((r) => r.code === c.iso3);
	return { year: imf.years[0], debt: own.debt, balance: own.balance, debtRank: i < 0 ? null : i + 1, of: ranked.length };
}

/** Todo lo que se sabe de un país con los datos descargados. */
export function countryProfile(
	c: Country,
	sets: { series: Series[]; imf: ImfData | null; curve: YieldCurveData | null }
): CountryProfile {
	const byId = new Map(sets.series.map((s) => [s.id, s]));
	const get: Get = (id) => byId.get(id);
	return {
		kpis: kpis(c, get),
		policy: policyRate(c, sets.series),
		bond: bond10(c, get, sets.curve),
		premium: premium(c, get),
		fx: fxRows(c, get),
		imf: imfRows(c, sets.imf),
		fiscal: imfFiscal(c, sets.imf)
	};
}
