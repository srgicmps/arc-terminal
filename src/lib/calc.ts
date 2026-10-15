// Calculadora y conversor de la barra (M46): «=1250*1.21» y «100 USD EUR». Sin eval: un parser propio de
// descenso recursivo (como los de los libros de compiladores), que solo entiende números y + − × ÷ ^ % ( ).

/** Lo que entiende la calculadora, en tokens: números, operadores y paréntesis. */
function tokenize(expr: string): (number | string)[] | null {
	const out: (number | string)[] = [];
	// La coma también es separador decimal: «1250*1,21».
	const s = expr.replace(/,/g, '.').replace(/[×x]/gi, '*').replace(/÷/g, '/').replace(/[−–]/g, '-');
	let i = 0;
	while (i < s.length) {
		const c = s[i];
		if (/\s/.test(c)) {
			i++;
		} else if (/[\d.]/.test(c)) {
			const m = s.slice(i).match(/^\d*\.?\d+(?:e[+-]?\d+)?|^\d+\.?/i)!;
			const n = Number(m[0]);
			if (!Number.isFinite(n)) return null;
			out.push(n);
			i += m[0].length;
		} else if ('+-*/^%()'.includes(c)) {
			out.push(c);
			i++;
		} else return null;
	}
	return out;
}

/**
 * El resultado de una expresión («1250*1.21», «(3+4)^2», «200*21%»), o null si no se entiende o no da un
 * número (dividir entre cero). Precedencia: paréntesis, ^ (por la derecha), signo, × ÷, + −. «%» detrás de un
 * número lo divide entre 100.
 */
export function evaluate(expr: string): number | null {
	const found = tokenize(expr);
	if (!found?.length) return null;
	const tokens = found;
	let pos = 0;
	const peek = () => tokens[pos];

	// suma := producto (('+' | '-') producto)*
	function sum(): number {
		let v = product();
		while (peek() === '+' || peek() === '-') v = tokens[pos++] === '+' ? v + product() : v - product();
		return v;
	}
	// producto := signo (('*' | '/') signo)*
	function product(): number {
		let v = unary();
		while (peek() === '*' || peek() === '/') v = tokens[pos++] === '*' ? v * unary() : v / unary();
		return v;
	}
	// signo := ('+' | '-') signo | potencia
	function unary(): number {
		if (peek() === '-') return pos++, -unary();
		if (peek() === '+') return pos++, unary();
		return power();
	}
	// potencia := átomo ('^' signo)?   (2^3^2 = 2^9)
	function power(): number {
		const base = atom();
		if (peek() !== '^') return base;
		pos++;
		return base ** unary();
	}
	// átomo := número '%'? | '(' suma ')' '%'?
	function atom(): number {
		const t = tokens[pos++];
		let v: number;
		if (typeof t === 'number') v = t;
		else if (t === '(') {
			v = sum();
			if (tokens[pos++] !== ')') throw new Error('falta )');
		} else throw new Error('se esperaba un número');
		if (peek() === '%') {
			pos++;
			v /= 100;
		}
		return v;
	}

	try {
		const v = sum();
		return pos === tokens.length && Number.isFinite(v) ? v : null;
	} catch {
		return null;
	}
}

/** «100 USD EUR», «100usd a eur», «2.500,5 gbp en usd»: cantidad y las dos divisas, o null. */
export function parseConversion(raw: string): { amount: number; from: string; to: string } | null {
	const m = raw
		.trim()
		.toUpperCase()
		.match(/^([\d.,]+)\s*([A-Z]{3})\s+(?:(?:A|EN|TO|→|->)\s+)?([A-Z]{3})$/);
	if (!m) return null;
	const amount = parseAmount(m[1]);
	return amount === null ? null : { amount, from: m[2], to: m[3] };
}

/**
 * «2.500,5» → 2500.5 y «1250.5» → 1250.5. Con coma, la coma es el decimal y los puntos son de miles; sin
 * coma, un punto seguido de tres cifras justas es de miles («2.500») y si no, decimal («1.21»).
 */
function parseAmount(s: string): number | null {
	let t = s;
	if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
	else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
	const n = Number(t);
	return t && Number.isFinite(n) ? n : null;
}

/** Un resultado para leerlo: «1.512,5», «0,0123», «1,23e+15». Hasta 10 cifras significativas. */
export function formatResult(n: number): string {
	if (n !== 0 && (Math.abs(n) >= 1e15 || Math.abs(n) < 1e-6)) return n.toExponential(4).replace('.', ',');
	return Number(n.toPrecision(10)).toLocaleString('es-ES', { maximumFractionDigits: 10 });
}

/** El mismo resultado para seguir calculando en la barra: «1512.5». */
export const plainResult = (n: number) => String(Number(n.toPrecision(12)));
