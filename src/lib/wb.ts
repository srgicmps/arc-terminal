// WB: bonos a 2, 10 y 30 años de EE. UU., la zona euro y Japón en una tabla, con las pendientes de la curva.
// Sale de las curvas que ya se descargan (uscurve, eacurve y jgb): no hay fuente nueva.
import type { YieldCurveData } from './types.ts';

export interface WbRow {
	code: string;
	name: string;
	/** Día del último dato (AAAA-MM-DD). */
	date: string;
	y2: number | null;
	y10: number | null;
	y30: number | null;
	/** Cambio del 10 años frente a la sesión anterior, en puntos básicos. */
	d10: number | null;
	/** Cambio del 10 años frente a hace un mes (o el día anterior más cercano), en pb. */
	m10: number | null;
	/** Pendiente 10 años − 2 años, en pb. */
	s2s10: number | null;
	/** Pendiente 30 años − 10 años, en pb. */
	s10s30: number | null;
}

export interface WbCurve {
	code: string;
	name: string;
	curve: YieldCurveData | null | undefined;
}

const pb = (a: number | null, b: number | null) => (a === null || b === null ? null : Math.round((a - b) * 100));

/** Último día con el 10 años y su valor en cada plazo. */
function lastDay(c: YieldCurveData) {
	const i10 = c.tenors.indexOf('10A');
	for (let i = c.days.length - 1; i >= 0; i--) if (c.days[i].values[i10] != null) return i;
	return -1;
}

export function wbRows(curves: WbCurve[]): WbRow[] {
	return curves.flatMap(({ code, name, curve }) => {
		if (!curve) return [];
		const i = lastDay(curve);
		if (i < 0) return [];
		const col = (label: string) => curve.tenors.indexOf(label);
		const val = (day: number, label: string) =>
			col(label) < 0 || day < 0 ? null : (curve.days[day].values[col(label)] ?? null);
		const date = curve.days[i].date;
		const month = new Date(Date.parse(`${date}T12:00:00Z`) - 30 * 86_400_000).toISOString().slice(0, 10);
		let im = -1;
		for (let j = i - 1; j >= 0; j--)
			if (curve.days[j].date <= month && val(j, '10A') !== null) {
				im = j;
				break;
			}
		let ip = i - 1;
		while (ip >= 0 && val(ip, '10A') === null) ip--;
		const y2 = val(i, '2A'),
			y10 = val(i, '10A'),
			y30 = val(i, '30A');
		return [
			{
				code,
				name,
				date,
				y2,
				y10,
				y30,
				d10: pb(y10, val(ip, '10A')),
				m10: pb(y10, val(im, '10A')),
				s2s10: pb(y10, y2),
				s10s30: pb(y30, y10)
			}
		];
	});
}
