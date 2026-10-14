// ECST: las grandes economías en una tabla, al estilo del ECST de Bloomberg. Sin fuentes nuevas: PIB, IPC,
// paro, deuda y saldo público son la estimación del año en curso del FMI (imf.ts); el tipo oficial, del BIS
// (bis.ts); el bono a 10 años, del BCE (media mensual de los del euro), del Tesoro de EE. UU. y del MOF de
// Japón (cierre del último día). Lo que no da ninguna fuente sale como «—».
import type { ImfCountry, Series, YieldCurveData } from './types.ts';

export interface EcstRow extends ImfCountry {
	/** Tipo oficial del banco central y bono a 10 años, en %. */
	rate: number | null;
	bond: number | null;
}

export type EcstKey = 'name' | 'gdp' | 'cpi' | 'unemployment' | 'rate' | 'bond' | 'debt' | 'balance';

/** Código del FMI → código del BIS. Los del euro comparten el tipo del BCE (XM). */
const BIS: Record<string, string> = {
	USA: 'us',
	GBR: 'gb',
	JPN: 'jp',
	CAN: 'ca',
	AUS: 'au',
	CHN: 'cn',
	MEX: 'mx',
	BRA: 'br',
	IND: 'in',
	TUR: 'tr',
	DEU: 'xm',
	FRA: 'xm',
	ITA: 'xm',
	ESP: 'xm'
};

/** Código del FMI → id del bono a 10 años en ecb.ts. */
const ECB_BONDS: Record<string, string> = { DEU: 'bond10-de', FRA: 'bond10-fr', ITA: 'bond10-it', ESP: 'bond10-es' };

const lastOf = (s: Series | undefined) => s?.points.at(-1)?.v ?? null;

/** El plazo de 10 años del último día de una curva. */
function tenYears(curve: YieldCurveData | undefined): number | null {
	const i = curve?.tenors.indexOf('10A') ?? -1;
	return i < 0 ? null : (curve?.days.at(-1)?.values[i] ?? null);
}

export function ecstRows(
	countries: ImfCountry[],
	series: Series[],
	curves: { us?: YieldCurveData; jp?: YieldCurveData }
): EcstRow[] {
	const byId = new Map(series.map((s) => [s.id, s]));
	const bond = (code: string) =>
		code === 'USA' ? tenYears(curves.us) : code === 'JPN' ? tenYears(curves.jp) : lastOf(byId.get(ECB_BONDS[code] ?? ''));
	return countries.map((c) => ({
		...c,
		rate: BIS[c.code] ? lastOf(byId.get(`policy-${BIS[c.code]}`)) : null,
		bond: bond(c.code)
	}));
}

/** Ordena por una columna; los «—» siempre al final, se ordene hacia arriba o hacia abajo. */
export function sortRows(rows: EcstRow[], key: EcstKey, dir: 'asc' | 'desc'): EcstRow[] {
	const sign = dir === 'asc' ? 1 : -1;
	return [...rows].sort((a, b) => {
		if (key === 'name') return sign * a.name.localeCompare(b.name, 'es');
		const x = a[key];
		const y = b[key];
		if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1;
		return sign * (x - y);
	});
}
