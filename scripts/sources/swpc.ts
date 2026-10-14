// Tormentas solares: NOAA Space Weather Prediction Center (SWPC). JSON público y sin clave, de dominio
// público (Gobierno de EE. UU.). Productos: https://services.swpc.noaa.gov/products/
// - noaa-planetary-k-index.json: índice Kp cada 3 h de los últimos 7 días. Históricamente es una tabla
//   en arrays cuya primera fila es la cabecera ([["time_tag","Kp",…],["2026-10-14 09:00:00.000","2.33",…]]),
//   pero la NOAA está pasando sus productos a listas de objetos: se leen las dos formas.
// - noaa-scales.json: escalas G, S y R. Claves "-1" (ayer), "0" (ahora) y "1", "2", "3" (previsión).
import type { SwpcData } from '../../src/lib/types.ts';
import { getJson, num, type Source } from '../lib.ts';

const API = 'https://services.swpc.noaa.gov/products';
const DAY_MS = 24 * 3600_000;

/** «2026-10-14 09:00:00.000» (UTC, sin zona) → «2026-10-14T09:00:00.000Z». null si no es una fecha. */
export function swpcTime(value: unknown): string | null {
	if (typeof value !== 'string' || !value.trim()) return null;
	let s = value.trim().replace(' ', 'T');
	if (!/(Z|[+-]\d{2}:?\d{2})$/.test(s)) s += 'Z';
	const t = Date.parse(s);
	return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

/** Busca un campo sin distinguir mayúsculas («Kp», «kp»…). */
function field(row: Record<string, unknown>, ...names: string[]): unknown {
	for (const name of names) {
		const key = Object.keys(row).find((k) => k.toLowerCase() === name.toLowerCase());
		if (key !== undefined) return row[key];
	}
	return undefined;
}

/** Lee la tabla de Kp, en arrays o en objetos. Devuelve los puntos ordenados del más antiguo al más reciente. */
export function parseKp(body: unknown): { t: string; v: number }[] {
	if (!Array.isArray(body)) return [];
	let rows: Record<string, unknown>[];
	if (body.every(Array.isArray)) {
		// Tabla en arrays: la primera fila es la cabecera si no empieza por una fecha.
		const first = (body[0] ?? []) as unknown[];
		const hasHeader = first.length > 0 && swpcTime(first[0]) === null;
		const header = hasHeader ? first.map(String) : ['time_tag', 'Kp'];
		rows = (hasHeader ? body.slice(1) : body).map((r: unknown[]) =>
			Object.fromEntries(header.map((name, i) => [name, r[i]]))
		);
	} else {
		rows = body.filter((r) => r && typeof r === 'object') as Record<string, unknown>[];
	}
	const points: { t: string; v: number }[] = [];
	for (const row of rows) {
		const t = swpcTime(field(row, 'time_tag', 'time'));
		const v = num(field(row, 'Kp', 'kp_index', 'estimated_kp'));
		if (t && v !== null && v >= 0 && v <= 9) points.push({ t, v });
	}
	return points.sort((a, b) => a.t.localeCompare(b.t));
}

/** Valor de una escala («G», «S», «R») en un día de noaa-scales.json: { G: { Scale: "1" } } o { "G.Scale": 1 }. */
function scale(day: unknown, letter: 'G' | 'S' | 'R'): number | null {
	if (!day || typeof day !== 'object') return null;
	const d = day as Record<string, unknown>;
	const inner = d[letter];
	const raw =
		inner && typeof inner === 'object' ? field(inner as Record<string, unknown>, 'Scale') : (d[`${letter}.Scale`] ?? inner);
	const n = num(typeof raw === 'string' ? raw.replace(/^[GSR]/i, '') : raw);
	return n !== null && n >= 0 && n <= 5 ? Math.round(n) : null;
}

/** Escalas actuales (clave "0") y la G más alta prevista (claves "1", "2"…). */
export function parseScales(body: unknown): Pick<SwpcData, 'g' | 's' | 'r' | 'gForecast' | 'gForecastDate'> {
	// Si algún día llega como lista, se toma en el orden de las claves: -1, 0, 1, 2, 3.
	const days: Record<string, unknown> = Array.isArray(body)
		? Object.fromEntries(body.map((d, i) => [String(i - 1), d]))
		: body && typeof body === 'object'
			? (body as Record<string, unknown>)
			: {};
	const now = days['0'];
	let gForecast: number | null = null;
	let gForecastDate: string | null = null;
	for (const key of Object.keys(days).filter((k) => /^\d+$/.test(k) && Number(k) > 0).sort((a, b) => Number(a) - Number(b))) {
		const g = scale(days[key], 'G');
		if (g === null || (gForecast !== null && g <= gForecast)) continue;
		gForecast = g;
		const date = field((days[key] ?? {}) as Record<string, unknown>, 'DateStamp');
		gForecastDate = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(date) ? date.slice(0, 10) : null;
	}
	return { g: scale(now, 'G'), s: scale(now, 'S'), r: scale(now, 'R'), gForecast, gForecastDate };
}

export const swpc: Source<SwpcData> = {
	name: 'swpc',
	label: 'NOAA SWPC · tormentas solares (Kp y escalas G, S, R)',
	maxAgeMinutes: 60,
	async fetch() {
		// El Kp es imprescindible; las escalas, no (sin ellas, la G se deduce del Kp en src/lib/space.ts).
		const [kpBody, scalesBody] = await Promise.all([
			getJson(`${API}/noaa-planetary-k-index.json`),
			getJson(`${API}/noaa-scales.json`).catch((error: Error) => {
				console.log(`  swpc · escalas: ${error.message}`);
				return null;
			})
		]);
		const points = parseKp(kpBody);
		const last = points.at(-1);
		if (!last) throw new Error('sin datos de Kp');
		// Últimas 24 h contadas desde la última medida (el Kp sale cada 3 h, con algo de retraso).
		const since = Date.parse(last.t) - DAY_MS;
		return {
			kp: last.v,
			kpAt: last.t,
			kp24: points.filter((p) => Date.parse(p.t) > since),
			...parseScales(scalesBody)
		};
	}
};
