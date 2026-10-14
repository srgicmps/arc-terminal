// Valores de defensa y geopolítica: un solo sitio para la lista que enseñan WS y GEO (DefenseQuotes) y que
// la barra de comandos abre como ficha (están también en TICKERS, src/lib/tickers.ts).
import { TICKERS, type Ticker } from './tickers.ts';

/** Códigos de TICKERS, por grupo. */
export const DEFENSE_GROUPS = [
	{ name: 'EE. UU.', codes: ['PLTR', 'LMT', 'RTX', 'NOC', 'GD', 'BA', 'LHX', 'ITA'] },
	{ name: 'Europa', codes: ['AIR', 'BAES', 'RHM', 'LDO', 'HO', 'SAAB', 'IDR'] }
] as const;

/** Empresas que no cotizan: sin precio, solo sus titulares (enlace a NEWS). */
export const DEFENSE_PRIVATE = ['Anduril'];

/** Los valores de cada grupo, con sus datos de TICKERS. */
export function defenseGroups(): { name: string; tickers: Ticker[] }[] {
	return DEFENSE_GROUPS.map((g) => ({
		name: g.name,
		tickers: g.codes.flatMap((code) => TICKERS.filter((t) => t.code === code))
	}));
}
