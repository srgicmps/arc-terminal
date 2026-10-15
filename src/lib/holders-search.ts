// Búsqueda de HDS, solo para las vistas: usa search.ts, que tira de la barra (import.meta.glob de Vite) y
// no se puede importar desde los scripts de Node, como holders.ts.
import { issuersFor, type HeldIssuer } from './holders.ts';
import { hasWords, queryWords } from './search.ts';
import { TICKERS } from './tickers.ts';

/**
 * Lo que se busca en HDS: un código de la barra («NVDA») va a su emisor; si no, palabras sueltas del nombre
 * («kraft»), sin tildes ni mayúsculas.
 */
export function findIssuers(query: string, issuers: HeldIssuer[]): HeldIssuer[] {
	const q = query.trim();
	if (!q) return [];
	const byCode = issuersFor(q, issuers);
	if (byCode.length || TICKERS.some((t) => t.code === q.toUpperCase())) return byCode;
	const words = queryWords(q);
	return issuers.filter((e) => hasWords(e.name, words));
}

/** Los más repartidos: los que tienen más fondos y, a igualdad, más dinero entre todos. */
export const mostShared = (issuers: HeldIssuer[], n = 20) =>
	[...issuers].sort((a, b) => b.holders.length - a.holders.length || b.total - a.total).slice(0, n);
