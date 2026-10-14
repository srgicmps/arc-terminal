// CMP: qué valores se comparan y qué plazos enseña la tabla de rentabilidad.

/** «NVDA, amd  AVGO» → ['NVDA', 'AMD', 'AVGO']: sin repetidos y como mucho `max` (los demás se ignoran). */
export function parseSymbols(raw: string | null | undefined, max = 5): string[] {
	const codes = (raw ?? '')
		.toUpperCase()
		.split(/[\s,;]+/)
		.filter((c) => /^[A-Z0-9.:!-]{1,20}$/.test(c));
	return [...new Set(codes)].slice(0, max);
}

/**
 * Plazos de la tabla, en el orden en que se leen, con las claves de perf.json (las de Finnhub sin
 * «PriceReturnDaily»). Finnhub no da «1 mes» ni «4 semanas»: «En el mes» es desde el día 1.
 */
export const PERF_PERIODS: readonly [key: string, label: string][] = [
	['5Day', '5 días'],
	['monthToDate', 'En el mes'],
	['13Week', '3 meses'],
	['52Week', '1 año'],
	['yearToDate', 'En el año']
];
