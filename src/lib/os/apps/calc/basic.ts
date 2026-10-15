// Lógica pura de la calculadora normal de Arc OS (con tests en basic.test.ts). Las cuentas, en calc.ts (evaluate).

/**
 * «200+10%» como en cualquier calculadora de bolsillo: 200 más el 10 % de 200 (= 220), no 200 + 0,1.
 * Solo el último término de la cuenta, fuera de paréntesis: «A + N%» → «(A)+(A)×N/100» (y lo mismo con −).
 * «50×10%» y «10%» siguen siendo «N/100», que ya hace evaluate().
 */
export function percentOf(expr: string): string {
	const m = expr.match(/^(.*[^+\-−–(])\s*([+\-−–])\s*(\d[\d.,]*(?:e[+-]?\d+)?)\s*%$/i);
	if (!m) return expr;
	const [, left, op, n] = m;
	let depth = 0;
	for (const c of left) {
		if (c === '(') depth++;
		else if (c === ')') depth--;
	}
	if (depth !== 0) return expr; // el % va dentro de un paréntesis sin cerrar
	// El signo debe ser una suma o resta de verdad, no el de un número («2×−10%»).
	if (/[×x*÷/^]\s*$/i.test(left)) return expr;
	return `(${left})${op}(${left})*${n}/100`;
}

/** Al pulsar una tecla justo después de «=»: una cifra empieza otra cuenta; un operador sigue con el resultado. */
export function afterResult(expr: string, key: string): string {
	return /^[\d,(]$/.test(key) ? key : expr + key;
}
