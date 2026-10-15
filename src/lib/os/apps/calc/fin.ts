// Cuentas financieras de la Calculadora de Arc OS. Funciones puras (sin navegador), con tests en fin.test.ts.

/** Valor final de un capital con interés compuesto mensual y una aportación al final de cada mes. */
export function compound(capital: number, ratePct: number, years: number, monthly = 0): number {
	const n = Math.round(years * 12);
	const r = ratePct / 100 / 12;
	if (r === 0) return capital + monthly * n;
	const g = (1 + r) ** n;
	return capital * g + (monthly * (g - 1)) / r;
}

/** Cuota mensual de un préstamo (sistema francés, el de las hipotecas en España). */
export function loanPayment(capital: number, ratePct: number, years: number): number {
	const n = Math.round(years * 12);
	if (n <= 0) return NaN;
	const r = ratePct / 100 / 12;
	if (r === 0) return capital / n;
	return (capital * r) / (1 - (1 + r) ** -n);
}

/** Rentabilidad anual compuesta (TAE de una inversión) de pasar de `start` a `end` en `years` años, en %. */
export function cagr(start: number, end: number, years: number): number {
	if (start <= 0 || end < 0 || years <= 0) return NaN;
	return ((end / start) ** (1 / years) - 1) * 100;
}

/**
 * Un número escrito a la española («1.250,5», «10.000») o a la inglesa («1250.5»). NaN si no lo es. Sin coma, un
 * punto seguido de tres cifras justas es de miles («150.000»), como en parseAmount de calc.ts; si no, decimal («1.5»).
 */
export function parseNum(s: string): number {
	let t = s.trim().replace(/\s|€|%/g, '');
	if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
	else if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
	return t === '' ? NaN : Number(t);
}
