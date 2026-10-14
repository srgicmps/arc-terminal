// FRED, Banco de la Reserva Federal de San Luis: series macro de EE. UU. https://fred.stlouisfed.org/docs/api/fred/
// Necesita una clave gratuita (FRED_API_KEY, en GitHub Secrets). Sin ella, la fuente se salta.
// Límite: unas 120 consultas por minuto por clave; aquí son 9 cada 3 horas.
// Condiciones: hay que avisar de que se usa la API de FRED sin su respaldo, y algunas series son de
// terceros con copyright (por ejemplo, el VIX de Cboe): solo se guardan unos pocos puntos con enlace a FRED.
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
	{ code: 'VIXCLS', id: 'vix', label: 'VIX', unit: 'pts', freq: 'd', last: 260 },
	{ code: 'DCOILWTICO', id: 'wti', label: 'Petróleo WTI', unit: '$', freq: 'd', last: 260 },
	{ code: 'DTWEXBGS', id: 'dollar-broad', label: 'Dólar, índice amplio', unit: 'pts', freq: 'd', last: 260 }
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
	label: 'Fed, curva, PCE, PIB, paro semanal, M2, VIX, petróleo y dólar · FRED (Fed de San Luis)',
	maxAgeMinutes: 175,
	requires: ENV,
	async fetch() {
		const key = process.env[ENV] ?? '';
		const found = await settle('fred', WANTED, (w) => w.code, (w) => series(w, key));
		if (!found.length) throw new Error('ninguna serie de FRED');
		return { series: found };
	}
};
