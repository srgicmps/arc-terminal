// FRED, Banco de la Reserva Federal de San Luis: series macro de EE. UU. https://fred.stlouisfed.org/docs/api/fred/
// Necesita una clave gratuita (FRED_API_KEY, en GitHub Secrets). Sin ella, la fuente se salta.
// Límite: unas 120 consultas por minuto por clave; aquí son 18 cada 3 horas.
// Condiciones: hay que avisar de que se usa la API de FRED sin su respaldo, y algunas series son de
// terceros con copyright (el VIX de Cboe, los diferenciales de ICE BofA): solo se guardan unos pocos puntos con
// enlace a FRED.
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
	/** Cómo se publica: así se escribe el periodo igual que en el resto de series («2026-09», «2026-Q2»…). */
	freq: 'd' | 'w' | 'm' | 'q';
	/** Transformación que calcula FRED: pc1 = variación interanual (%), pca = tasa anualizada (%). */
	units?: 'pc1' | 'pca';
	/** Cuántas observaciones (las más recientes). */
	last: number;
	/** Para pasar de personas a miles, por ejemplo. */
	scale?: number;
}

const WANTED: Wanted[] = [
	{ code: 'DFF', id: 'fedfunds-us', label: 'Fondos federales (efectivo)', unit: '%', freq: 'd', last: 260 },
	{ code: 'T10Y2Y', id: 't10y2y-us', label: 'Diferencial 10 años − 2 años', unit: '%', freq: 'd', last: 260 },
	{ code: 'PCEPILFE', id: 'core-pce-us', label: 'PCE subyacente, interanual', unit: '%', freq: 'm', units: 'pc1', last: 36 },
	{ code: 'GDPC1', id: 'gdp-us', label: 'PIB real, tasa anualizada', unit: '%', freq: 'q', units: 'pca', last: 16 },
	{ code: 'ICSA', id: 'claims-us', label: 'Solicitudes de paro (miles)', unit: 'miles', freq: 'w', last: 104, scale: 1 / 1000 },
	{ code: 'M2SL', id: 'm2-us', label: 'M2, interanual', unit: '%', freq: 'm', units: 'pc1', last: 36 },
	// Balance de la Fed: total del activo, semanal (miércoles), en millones de dólares.
	{ code: 'WALCL', id: 'fed-balance', label: 'Balance de la Fed', unit: 'M$', freq: 'w', last: 160 },
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
	// Diferenciales de crédito (OAS de ICE BofA, en %): lo que pagan de más los bonos de empresa sobre el Tesoro (WS).
	// ICE solo deja a FRED publicar unos años de historia: con 260 días (un año) basta para la media.
	{ code: 'BAMLH0A0HYM2', id: 'hy-us', label: 'Alto rendimiento EE. UU.', unit: '%', freq: 'd', last: 260 },
	{ code: 'BAMLC0A0CM', id: 'ig-us', label: 'Grado de inversión EE. UU.', unit: '%', freq: 'd', last: 260 },
	{ code: 'BAMLHE00EHYIOAS', id: 'hy-eu', label: 'Alto rendimiento euro', unit: '%', freq: 'd', last: 260 }
];

/** «2026-09-01» → «2026-09» (mensual) o «2026-Q3» (trimestral); diaria y semanal, tal cual. */
function periodOf(date: string, freq: Wanted['freq']): string {
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

export const fred: Source<SeriesData> = {
	name: 'fred',
	label: 'Fed, balance de la Fed, curva, PCE, PIB, paro semanal, M2, VIX, petróleo y dólar · FRED (Fed de San Luis)',
	maxAgeMinutes: 175,
	requires: ENV,
	// Si a la copia le falta alguna serie (p. ej., recién añadida, como el balance de la Fed o la hipoteca), se descarga de nuevo.
	isStale: (previous) => WANTED.some((w) => !previous.series?.some((s) => s.id === w.id)),
	async fetch() {
		const key = process.env[ENV] ?? '';
		const found = await settle('fred', WANTED, (w) => w.code, (w) => series(w, key));
		if (!found.length) throw new Error('ninguna serie de FRED');
		return { series: found };
	}
};
