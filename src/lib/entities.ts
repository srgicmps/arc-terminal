// Fichas (M29): qué es lo que se busca en NEWS. «Lagarde», «BCE», «Japón» o «NVDA» tienen ficha propia,
// que sale arriba con un resumen y el enlace a su vista; los titulares van debajo. Sin Svelte, para probarlo.
import { BANKS, type Bank } from './meetings.ts';
import { findCountries, findCountry, type Country } from './countries.ts';
import { LEADERS, type Leader } from './leaders.ts';
import { names, namePattern, plain } from './news.ts';
import { fold } from './search.ts';
import { TICKERS, type Ticker } from './tickers.ts';

export type Entity =
	| { kind: 'ticker'; ticker: Ticker }
	| { kind: 'leader'; leader: Leader }
	| { kind: 'bank'; bank: Bank }
	| { kind: 'country'; country: Country };

/** Otros nombres de cada banco central, además de los de BANKS. */
const BANK_ALIASES: Record<Bank, string[]> = {
	ecb: ['ECB', 'European Central Bank'],
	fed: ['Federal Reserve', 'Reserva Federal de EE. UU.', 'FOMC']
};

/**
 * La ficha de lo buscado, o null. Solo con el nombre entero (o el apellido de un líder, o el código de un
 * valor): «Lagarde», «BCE», «Japón», «NVDA», «Zara». Así «inflación en Japón» no abre la ficha de Japón.
 */
export function findEntity(query: string | null | undefined): Entity | null {
	const q = fold(query ?? '').trim().replace(/\s+/g, ' ');
	if (q.length < 2) return null;
	const is = (name: string) => fold(name) === q;
	const ticker = TICKERS.find((t) => is(t.code) || is(t.name) || (t.aliases ?? []).some(is));
	if (ticker) return { kind: 'ticker', ticker };
	const leader = LEADERS.find((l) => is(l.name) || is(l.name.split(' ').at(-1) ?? ''));
	if (leader) return { kind: 'leader', leader };
	const bank = (Object.keys(BANKS) as Bank[]).find((b) => [BANKS[b].name, BANKS[b].long, ...BANK_ALIASES[b]].some(is));
	if (bank) return { kind: 'bank', bank };
	// findCountry también busca por el principio del nombre («reino» → Reino Unido): aquí solo si es entero.
	const country = findCountry(q);
	if (country && [country.code, country.iso3, country.name, ...(country.aliases ?? [])].some(is)) return { kind: 'country', country };
	return null;
}

/** Un nombre con ficha dentro de un titular: el texto que se enseña y lo que se busca en NEWS. */
export interface EntityLink {
	label: string;
	query: string;
}

// Las expresiones se preparan una vez (la primera vez que hacen falta), no en cada titular.
let named: { label: string; query: string; re: RegExp[] }[] | undefined;
function compile() {
	return [
		...TICKERS.map((t) => ({ label: t.name.replace(/\s*\(.*\)\s*$/, ''), query: t.code, re: names(t).map(namePattern) })),
		...LEADERS.map((l) => ({ label: l.name.split(' ').at(-1) ?? l.name, query: l.name, re: [namePattern(l.name.split(' ').at(-1) ?? l.name)] })),
		...(Object.keys(BANKS) as Bank[]).map((b) => ({
			label: BANKS[b].name,
			query: BANKS[b].name,
			re: [BANKS[b].name, BANKS[b].long, ...BANK_ALIASES[b]].map(namePattern)
		}))
	];
}

/**
 * Los nombres con ficha que salen en un texto (M30): valores, líderes, bancos centrales y países, sin
 * repetir y como mucho `max`. Cada uno lleva a su ficha en NEWS (/news?q=…).
 */
export function entitiesIn(text: string, max = 3): EntityLink[] {
	named ??= compile();
	const t = plain(text);
	const found = named.filter((n) => n.re.some((re) => re.test(t))).map(({ label, query }) => ({ label, query }));
	const countries = findCountries(text).map((c) => ({ label: c.name, query: c.name }));
	const seen = new Set<string>();
	return [...found, ...countries].filter((e) => !seen.has(e.query) && seen.add(e.query)).slice(0, max);
}
