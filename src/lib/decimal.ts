// Números que se escriben a mano en HIPOTECA y AHORRO, con coma decimal («2,5») como se escribe en España.
// Un <input type="number"> no la entiende: Chrome descarta la coma y «2,5» se queda en 25. Por eso esos campos son
// de texto (inputmode="decimal") y pasan por aquí.

/**
 * Lee un número escrito a mano: «2,5», «2.5», «-0,75». Con `thousands` (importes en euros), el punto separa
 * miles si va en grupos de tres («150.000», «1.250.000,50»). null si está vacío o no es un número.
 */
export function parseDecimal(text: string, thousands = false): number | null {
	let s = text.replace(/[\s €%]/g, '').replace('−', '-');
	if (!s) return null;
	if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
	else if (thousands && /^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
	if (!/^-?(\d+\.?\d*|\.\d+)$/.test(s)) return null;
	const v = Number(s);
	return Number.isFinite(v) ? v : null;
}

/** Cómo se enseña un número en el campo: con coma decimal y sin separador de miles («2,5», «150000»). */
export function showDecimal(v: number | null | undefined): string {
	if (v === null || v === undefined || !Number.isFinite(v)) return '';
	return String(Math.round(v * 1e6) / 1e6).replace('.', ',');
}
