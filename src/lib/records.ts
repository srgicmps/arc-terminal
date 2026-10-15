// Récords (lote 26-B, idea 10): si el último dato de una serie es el más alto o el más bajo de varios años.
// Solo con la historia que guarda cada JSON (las mensuales suelen traer 36 datos, 3 años; las diarias, 1 año):
// si en ese tramo hubo un dato igual o más extremo, «desde» es su año; si no lo hubo, «en N años» (todo el tramo).
// Por debajo de MIN_YEARS no se marca nada: un máximo de un año no es noticia.
import type { Point } from './types.ts';

export const MIN_YEARS = 2;

export interface SeriesRecord {
	kind: 'max' | 'min';
	/** Año del último dato igual o más extremo; null si no lo hay en la historia guardada. */
	since: number | null;
	/** Años que cubre el récord (enteros, hacia abajo). */
	years: number;
}

/** Fecha aproximada de un periodo: «2026-10», «2026-Q3», «2026-W41», «2026-10-14» o un instante ISO. En años. */
export function yearsOf(t: string): number | null {
	const y = Number(t.slice(0, 4));
	if (!Number.isFinite(y)) return null;
	let m = /^\d{4}-(\d{2})(?:-(\d{2}))?/.exec(t);
	if (m) return y + (Number(m[1]) - 1) / 12 + (m[2] ? (Number(m[2]) - 1) / 365 : 0);
	m = /^\d{4}-Q(\d)$/.exec(t);
	if (m) return y + (Number(m[1]) - 1) / 4;
	m = /^\d{4}-W(\d{2})$/.exec(t);
	if (m) return y + (Number(m[1]) - 1) / 52;
	return /^\d{4}$/.test(t) ? y : null;
}

/** Récord del último dato, o null si no lo es (o no cubre MIN_YEARS). */
export function seriesRecord(points: readonly Point[]): SeriesRecord | null {
	if (points.length < 3) return null;
	const last = points.at(-1)!;
	const end = yearsOf(last.t);
	if (end === null) return null;
	for (const kind of ['max', 'min'] as const) {
		const beyond = (v: number) => (kind === 'max' ? v >= last.v : v <= last.v);
		let j = points.length - 2;
		while (j >= 0 && !beyond(points[j].v)) j--;
		// El dato anterior ya lo iguala o lo supera: no es récord en este sentido.
		if (j === points.length - 2) continue;
		const from = yearsOf(j >= 0 ? points[j].t : points[0].t);
		if (from === null) continue;
		const years = Math.floor(end - from + 1e-9);
		if (years < MIN_YEARS) continue;
		return { kind, since: j >= 0 ? Number(points[j].t.slice(0, 4)) : null, years };
	}
	return null;
}

/** «máx. desde 2019», «mín. en 3 años». */
export function recordLabel(r: SeriesRecord): string {
	const word = r.kind === 'max' ? 'máx.' : 'mín.';
	return r.since !== null ? `${word} desde ${r.since}` : `${word} en ${r.years} años`;
}
