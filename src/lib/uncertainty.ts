// Incertidumbre económica: índices EPU de Baker, Bloom y Davis (policyuncertainty.com). Sin clave.
// - Mundial, mensual (GEPU: media de 21 países ponderada por su PIB; 100 = media de 1997–2015).
// - EE. UU., diario (prensa de EE. UU.; muy ruidoso: se enseña la media de 30 días).
// Uso: datos de descarga libre; la web pide citar a Baker, Bloom y Davis (2016) y a Davis (2016) para el mundial, y no
// publica condiciones de uso ni límites por IP (/terms.html da 404). Aquí son dos descargas cada 12 h.
// Sin imports de Vite: lo usa también el script de Node.
import type { Point, Series } from './types.ts';

export interface UncertaintyData {
	series: Series[];
}

export const EPU_URL = 'https://www.policyuncertainty.com/';
const SOURCE = 'Baker, Bloom y Davis';

/** Hoja del EPU mundial: «Year | Month | GEPU_current | GEPU_ppp», más una fila final con la cita. */
export function parseGlobalEpu(cells: unknown[][]): Point[] {
	const head = cells.findIndex((r) => r.some((c) => /GEPU_current/i.test(String(c ?? ''))));
	if (head < 0) return [];
	const col = cells[head].findIndex((c) => /GEPU_current/i.test(String(c ?? '')));
	const out: Point[] = [];
	for (const row of cells.slice(head + 1)) {
		const y = Number(row[0]);
		const m = Number(row[1]);
		const v = Number(row[col]);
		if (!Number.isInteger(y) || y < 1990 || !(m >= 1 && m <= 12) || !Number.isFinite(v) || v <= 0) continue;
		out.push({ t: `${y}-${String(m).padStart(2, '0')}`, v });
	}
	return out;
}

/** CSV diario de EE. UU.: «day,month,year,daily_policy_index». */
export function parseDailyEpu(csv: string): Point[] {
	const out: Point[] = [];
	for (const line of csv.split(/\r?\n/)) {
		const [d, m, y, value] = line.split(',').map(Number);
		if (!(y >= 1985 && m >= 1 && m <= 12 && d >= 1 && d <= 31) || !Number.isFinite(value)) continue;
		out.push({ t: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, v: value });
	}
	return out.sort((a, b) => a.t.localeCompare(b.t));
}

/** Media móvil de `n` puntos: un punto por día desde que hay `n` datos. */
export function rolling(points: Point[], n: number): Point[] {
	const out: Point[] = [];
	let sum = 0;
	points.forEach((p, i) => {
		sum += p.v;
		if (i >= n) sum -= points[i - n].v;
		if (i >= n - 1) out.push({ t: p.t, v: Math.round((sum / n) * 10) / 10 });
	});
	return out;
}

export function epuSeries(global: Point[], daily: Point[]): Series[] {
	const series: Series[] = [];
	if (global.length)
		series.push({
			id: 'epu-global',
			label: 'Mundial (mensual)',
			unit: '',
			points: global.slice(-37),
			source: SOURCE,
			url: `${EPU_URL}global_monthly.html`
		});
	if (daily.length)
		series.push({
			id: 'epu-us',
			label: 'EE. UU. (media de 30 días)',
			unit: '',
			geo: 'US',
			points: rolling(daily.slice(-400), 30).slice(-120),
			source: SOURCE,
			url: `${EPU_URL}us_daily.html`
		});
	return series;
}
