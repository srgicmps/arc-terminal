// FRED, Banco de la Reserva Federal de San Luis: series macro de EE. UU. https://fred.stlouisfed.org/docs/api/fred/
// Necesita una clave gratuita (FRED_API_KEY, en GitHub Secrets). Sin ella, la fuente se salta.
// Límite: unas 120 consultas por minuto por clave; aquí son 41 cada 3 horas.
// Condiciones: hay que avisar de que se usa la API de FRED sin su respaldo, y algunas series son de
// terceros con copyright (el VIX de Cboe, los diferenciales de ICE BofA): solo se guardan unos pocos puntos
// con enlace a FRED y la fuente citada.
import { at } from '../../src/lib/series.ts';
import type { Point, Series, SeriesData } from '../../src/lib/types.ts';
import { getJson, num, settle, type Source } from '../lib.ts';

const API = 'https://api.stlouisfed.org/fred/series/observations';
const ENV = 'FRED_API_KEY';

interface Wanted {
	/** Código de la serie en FRED. */
	code: string;
	id: string;
	label: string;
	unit: string;
	/** Cómo se publica: así se escribe el periodo igual que en el resto de series («2026-09», «2026-Q2», «2026»…). */
	freq: 'd' | 'w' | 'm' | 'q' | 'a';
	/** Transformación que calcula FRED: pc1 = variación interanual (%), pca = tasa anualizada (%). */
	units?: 'pc1' | 'pca';
	/** Cuántas observaciones (las más recientes). */
	last: number;
	/** Para pasar de personas a miles, por ejemplo. */
	scale?: number;
}

const WANTED: Wanted[] = [
	{ code: 'DFF', id: 'fedfunds-us', label: 'Fondos federales (efectivo)', unit: '%', freq: 'd', last: 260 },
	// Mercado monetario: el repo a un día con garantía de deuda pública, lo que la Fed paga por las reservas y la letra a 3 meses.
	{ code: 'SOFR', id: 'sofr-us', label: 'SOFR', unit: '%', freq: 'd', last: 260 },
	{ code: 'IORB', id: 'iorb-us', label: 'Remuneración de las reservas (IORB)', unit: '%', freq: 'd', last: 260 },
	{ code: 'DTB3', id: 'tbill3m-us', label: 'Letra del Tesoro a 3 meses', unit: '%', freq: 'd', last: 260 },
	{ code: 'T10Y2Y', id: 't10y2y-us', label: 'Diferencial 10 años − 2 años', unit: '%', freq: 'd', last: 260 },
	// Señales de recesión (ECO): regla de Sahm en tiempo real (puntos), probabilidad de recesión del modelo de
	// Chauvet y Piger (suavizada, llega con 2–3 meses de retraso) y diferencial 10 años − 3 meses.
	{ code: 'SAHMREALTIME', id: 'sahm-us', label: 'Regla de Sahm (tiempo real)', unit: '%', freq: 'm', last: 36 },
	{ code: 'RECPROUSM156N', id: 'recprob-us', label: 'Probabilidad de recesión (modelo)', unit: '%', freq: 'm', last: 36 },
	{ code: 'T10Y3M', id: 't10y3m-us', label: 'Diferencial 10 años − 3 meses', unit: '%', freq: 'd', last: 260 },
	{ code: 'PCEPILFE', id: 'core-pce-us', label: 'PCE subyacente, interanual', unit: '%', freq: 'm', units: 'pc1', last: 36 },
	{ code: 'GDPC1', id: 'gdp-us', label: 'PIB real, tasa anualizada', unit: '%', freq: 'q', units: 'pca', last: 16 },
	// GDPNow de la Fed de Atlanta: estimación en tiempo real del PIB del trimestre en curso (tasa anualizada); cambia varias veces al mes.
	{ code: 'GDPNOW', id: 'gdpnow-us', label: 'GDPNow (PIB del trimestre en curso)', unit: '%', freq: 'q', last: 12 },
	{ code: 'ICSA', id: 'claims-us', label: 'Solicitudes de paro (miles)', unit: 'miles', freq: 'w', last: 104, scale: 1 / 1000 },
	{ code: 'M2SL', id: 'm2-us', label: 'M2, interanual', unit: '%', freq: 'm', units: 'pc1', last: 36 },
	// Balance de la Fed: total del activo, semanal (miércoles), en millones de dólares.
	{ code: 'WALCL', id: 'fed-balance', label: 'Balance de la Fed', unit: 'M$', freq: 'w', last: 160 },
	// Para la liquidez neta (WALCL − TGA − RRP): cuenta del Tesoro en la Fed (semanal, miércoles, millones de $)
	// y repos inversas a un día (diarias, en miles de millones de $: se pasan a millones).
	{ code: 'WTREGEN', id: 'fed-tga', label: 'Cuenta del Tesoro en la Fed (TGA)', unit: 'M$', freq: 'w', last: 160 },
	{ code: 'RRPONTSYD', id: 'fed-rrp', label: 'Repos inversas de la Fed (RRP)', unit: 'M$', freq: 'd', last: 800, scale: 1000 },
	{ code: 'VIXCLS', id: 'vix', label: 'VIX', unit: 'pts', freq: 'd', last: 260 },
	{ code: 'DCOILWTICO', id: 'wti', label: 'Petróleo WTI', unit: '$', freq: 'd', last: 260 },
	{ code: 'DTWEXBGS', id: 'dollar-broad', label: 'Dólar, índice amplio', unit: 'pts', freq: 'd', last: 260 },
	// Hipoteca fija a 30 años (encuesta semanal de Freddie Mac): dos años de jueves.
	{ code: 'MORTGAGE30US', id: 'mortgage30-us', label: 'Hipoteca fija a 30 años', unit: '%', freq: 'w', last: 104 },
	// Inflación esperada por el mercado (breakevens: bono nominal menos el ligado a la inflación) y tipo real (ECO).
	{ code: 'T5YIE', id: 'breakeven5-us', label: 'Inflación esperada a 5 años', unit: '%', freq: 'd', last: 260 },
	{ code: 'T10YIE', id: 'breakeven10-us', label: 'Inflación esperada a 10 años', unit: '%', freq: 'd', last: 260 },
	{ code: 'T5YIFR', id: 'forward5y5y-us', label: 'Inflación esperada a 5 años dentro de 5', unit: '%', freq: 'd', last: 260 },
	{ code: 'DFII10', id: 'real10-us', label: 'Tipo real a 10 años (TIPS)', unit: '%', freq: 'd', last: 260 },
	// Diferenciales de crédito (OAS de ICE BofA, en %): lo que pagan de más los bonos de empresa sobre la deuda
	// pública (ECO y aviso P2 del alto rendimiento). Aprobado por Sergi (D31), citando «ICE Data Indices vía FRED».
	{ code: 'BAMLH0A0HYM2', id: 'hy-us', label: 'Alto rendimiento EE. UU.', unit: '%', freq: 'd', last: 260 },
	{ code: 'BAMLC0A0CM', id: 'ig-us', label: 'Grado de inversión EE. UU.', unit: '%', freq: 'd', last: 260 },
	{ code: 'BAMLHE00EHYIOAS', id: 'hy-eu', label: 'Alto rendimiento euro', unit: '%', freq: 'd', last: 260 },
	// Índice de estrés financiero de la Fed de San Luis (semanal): 0 = lo normal; cada punto, una desviación típica
	// por encima o por debajo. Para el panel provisional «Estrés financiero» de ECO (src/lib/stress.ts).
	{ code: 'STLFSI4', id: 'stlfsi-us', label: 'Estrés financiero (Fed de San Luis)', unit: 'pts', freq: 'w', last: 104 },
	// Crédito y morosidad en EE. UU. (panel provisional de ECO): crédito bancario (semanal) y al consumo (mensual) en
	// variación interanual que calcula FRED (pc1: frente a la misma semana o mes de hace un año), y morosidad de
	// las tarjetas de crédito (trimestral, % desestacionalizado).
	{ code: 'TOTBKCR', id: 'bankcredit-us', label: 'Crédito bancario, interanual', unit: '%', freq: 'w', units: 'pc1', last: 104 },
	{ code: 'TOTALSL', id: 'consumercredit-us', label: 'Crédito al consumo, interanual', unit: '%', freq: 'm', units: 'pc1', last: 36 },
	{ code: 'DRCCLACBS', id: 'ccdelinq-us', label: 'Morosidad de tarjetas de crédito', unit: '%', freq: 'q', last: 16 },
	// Proyecciones de la Fed (SEP, cuatro veces al año) para el panel provisional de ECO (src/lib/sep.ts): mediana
	// de los participantes del FOMC y rango (el más bajo y el más alto). Anuales: la fecha es el año proyectado
	// (2026-01-01 = proyección para 2026); las 4 últimas son el año en curso y los siguientes. Si un código falla,
	// el resto sigue (settle) y el panel oculta lo que falte.
	{ code: 'FEDTARMD', id: 'sep-rate-md', label: 'Fondos federales, proyección (mediana)', unit: '%', freq: 'a', last: 4 },
	{ code: 'FEDTARRL', id: 'sep-rate-lo', label: 'Fondos federales, proyección (mínimo)', unit: '%', freq: 'a', last: 4 },
	{ code: 'FEDTARRH', id: 'sep-rate-hi', label: 'Fondos federales, proyección (máximo)', unit: '%', freq: 'a', last: 4 },
	{ code: 'PCECTPIMD', id: 'sep-pce-md', label: 'Inflación PCE, proyección (mediana)', unit: '%', freq: 'a', last: 4 },
	{ code: 'PCECTPIRL', id: 'sep-pce-lo', label: 'Inflación PCE, proyección (mínimo)', unit: '%', freq: 'a', last: 4 },
	{ code: 'PCECTPIRH', id: 'sep-pce-hi', label: 'Inflación PCE, proyección (máximo)', unit: '%', freq: 'a', last: 4 },
	{ code: 'UNRATEMD', id: 'sep-unrate-md', label: 'Paro, proyección (mediana)', unit: '%', freq: 'a', last: 4 },
	{ code: 'UNRATERL', id: 'sep-unrate-lo', label: 'Paro, proyección (mínimo)', unit: '%', freq: 'a', last: 4 },
	{ code: 'UNRATERH', id: 'sep-unrate-hi', label: 'Paro, proyección (máximo)', unit: '%', freq: 'a', last: 4 },
	// Largo plazo: un solo dato, el de la última SEP (su fecha se guarda tal cual).
	{ code: 'FEDTARMDLR', id: 'sep-rate-lr', label: 'Fondos federales a largo plazo, proyección (mediana)', unit: '%', freq: 'd', last: 1 }
];

/** «2026-09-01» → «2026-09» (mensual), «2026-Q3» (trimestral) o «2026» (anual); diaria y semanal, tal cual. */
function periodOf(date: string, freq: Wanted['freq']): string {
	if (freq === 'a') return date.slice(0, 4);
	if (freq === 'm') return date.slice(0, 7);
	if (freq === 'q') return `${date.slice(0, 4)}-Q${Math.floor((Number(date.slice(5, 7)) - 1) / 3) + 1}`;
	return date;
}

type Raw = { observations?: { date?: unknown; value?: unknown }[] | null };

/** ¿Es una fecha real con la forma «2026-09-01»? (Descarta «2026-13-45», texto suelto o nada.) */
function isDate(value: unknown): value is string {
	if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
	const d = new Date(`${value}T00:00:00Z`);
	return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Convierte la respuesta de FRED en una serie. Separada para poder probarla con una respuesta de ejemplo. */
export function toSeries(w: Wanted, body: Raw): Series | null {
	const points = (body.observations ?? [])
		.map((o) => {
			const v = num(o.value); // FRED marca los huecos con «.»
			// Una observación sin fecha válida se descarta sola; el resto de la serie sigue.
			return v === null || !isDate(o.date) ? null : { t: periodOf(o.date, w.freq), v: w.scale ? Math.round(v * w.scale * 10) / 10 : v };
		})
		.filter((p): p is Point => p !== null)
		.sort((a, b) => a.t.localeCompare(b.t));
	if (!points.length) return null;
	return {
		id: w.id,
		label: w.label,
		unit: w.unit,
		geo: 'US',
		points,
		source: 'FRED',
		url: `https://fred.stlouisfed.org/series/${w.code}`
	};
}

async function series(w: Wanted, key: string): Promise<Series | null> {
	const params = new URLSearchParams({
		series_id: w.code,
		api_key: key,
		file_type: 'json',
		sort_order: 'desc',
		limit: String(w.last)
	});
	if (w.units) params.set('units', w.units);
	try {
		return toSeries(w, await getJson<Raw>(`${API}?${params}`));
	} catch (error) {
		// FRED solo acepta la clave en la URL, y los errores llevan la URL: se quita antes de que
		// llegue al registro o a status.json, que es público.
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(message.replaceAll(key, '***').replace(/\?.*$/, ''));
	}
}

/**
 * Liquidez neta de la Fed, cada miércoles del balance: activo total (WALCL) − cuenta del Tesoro (TGA) − repos
 * inversas (RRP), en millones de $. Es lo que de verdad queda en el sistema: el dinero que el Tesoro guarda en
 * la Fed o que los fondos aparcan en las repos inversas no circula. Para TGA y RRP se toma el dato de ese día
 * o el anterior más cercano. Null si falta alguna de las tres.
 */
export function netLiquidity(walcl?: Series, tga?: Series, rrp?: Series): Series | null {
	if (!walcl || !tga || !rrp) return null;
	const points = walcl.points.flatMap((p) => {
		const t = at(tga, p.t);
		const r = at(rrp, p.t);
		return t && r ? [{ t: p.t, v: Math.round(p.v - t.v - r.v) }] : [];
	});
	if (!points.length) return null;
	return {
		id: 'fed-net-liquidity',
		label: 'Liquidez neta de la Fed',
		unit: 'M$',
		geo: 'US',
		points,
		source: 'FRED',
		url: 'https://fred.stlouisfed.org/series/WALCL'
	};
}

export const fred: Source<SeriesData> = {
	name: 'fred',
	label: 'Fed, balance de la Fed, curva, PCE, PIB, paro semanal, M2, VIX, petróleo, dólar y crédito · FRED (Fed de San Luis)',
	maxAgeMinutes: 175,
	requires: ENV,
	// Si a la copia le falta alguna serie (p. ej., recién añadida, como el balance de la Fed o la hipoteca), se descarga de nuevo.
	isStale: (previous) => WANTED.some((w) => !previous.series?.some((s) => s.id === w.id)),
	async fetch() {
		const key = process.env[ENV] ?? '';
		const found = await settle('fred', WANTED, (w) => w.code, (w) => series(w, key));
		if (!found.length) throw new Error('ninguna serie de FRED');
		const byId = (id: string) => found.find((s) => s.id === id);
		const net = netLiquidity(byId('fed-balance'), byId('fed-tga'), byId('fed-rrp'));
		if (net) {
			// Para comprobar en el registro el orden de magnitud (todo en millones de $).
			const last = (s?: Series) => s?.points.at(-1)?.v;
			console.log(`  fred · liquidez neta ${last(net)} = ${last(byId('fed-balance'))} − TGA ${last(byId('fed-tga'))} − RRP ${last(byId('fed-rrp'))}`);
		}
		return { series: net ? [...found, net] : found };
	}
};
