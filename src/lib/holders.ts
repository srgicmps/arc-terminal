// HDS: qué fondos de FONDOS tienen un valor. Se invierten las carteras 13F que baja scripts/sources/funds.ts:
// en lugar de «qué tiene Berkshire», «quién tiene Apple». Solo los fondos que sigue FONDOS y con el retraso
// del 13F (hasta 45 días tras el fin del trimestre). Lo usan el script (al bajar los datos) y las vistas.
import { TICKERS } from './tickers.ts';

/** Un fondo que tiene el valor. */
export interface Holder {
	/** Clave del fondo («BRK»). */
	fund: string;
	/** Valor declarado, en dólares. */
	value: number;
	shares: number;
	/** Peso en la cartera del fondo (0–1). */
	weight: number;
	/** Puesto en su cartera (1 = la mayor). */
	rank: number;
	/** Frente al trimestre anterior: nueva, compra más, vende parte o igual; null si no hay trimestre anterior. */
	change: 'new' | 'add' | 'trim' | 'same' | null;
	/** Cambio relativo de acciones (0,25 = +25 %), si no es nueva. */
	pct: number | null;
}

/** Un valor y los fondos que lo tienen, del que más al que menos. */
export interface HeldIssuer {
	cusip: string;
	name: string;
	/** Suma de lo que declaran todos los fondos, en dólares. */
	total: number;
	holders: Holder[];
}

/** Una línea de acciones (sin opciones) de una cartera, para invertirla. */
export interface Line {
	cusip: string;
	name: string;
	value: number;
	shares: number;
}

/** Puestos de cada cartera que entran en el índice: la unión de las 100 mayores de cada fondo. */
export const TOP_INDEXED = 100;

/**
 * Invierte las carteras. Entran los valores que están entre las `top` mayores de algún fondo y, de cada uno,
 * todos los fondos que lo tienen, en cualquier puesto. Ordenado por lo que suman entre todos.
 */
export function buildHolders(
	portfolios: { fund: string; current: Line[]; previous: Line[] | null }[],
	top = TOP_INDEXED
): HeldIssuer[] {
	const byCusip = new Map<string, HeldIssuer>();
	const chosen = new Set<string>();
	for (const p of portfolios) {
		const sorted = [...p.current].sort((a, b) => b.value - a.value);
		const total = sorted.reduce((s, l) => s + l.value, 0);
		const before = p.previous && new Map(p.previous.map((l) => [l.cusip, l.shares]));
		sorted.forEach((l, i) => {
			if (i < top) chosen.add(l.cusip);
			const old = before ? (before.get(l.cusip) ?? 0) : null;
			const change = old === null ? null : !old ? 'new' : l.shares > old ? 'add' : l.shares < old ? 'trim' : 'same';
			const holder: Holder = {
				fund: p.fund,
				value: l.value,
				shares: l.shares,
				weight: total ? l.value / total : 0,
				rank: i + 1,
				change,
				pct: old ? (l.shares - old) / old : null
			};
			const entry = byCusip.get(l.cusip) ?? { cusip: l.cusip, name: l.name, total: 0, holders: [] };
			entry.total += l.value;
			entry.holders.push(holder);
			byCusip.set(l.cusip, entry);
		});
	}
	return [...byCusip.values()]
		.filter((e) => chosen.has(e.cusip))
		.map((e) => ({ ...e, holders: e.holders.sort((a, b) => b.value - a.value) }))
		.sort((a, b) => b.total - a.total);
}

/** Palabras de forma jurídica o de clase que no cuentan al comparar nombres. */
const NOISE = new Set(
	'inc corp corporation co company ltd limited plc holdings hldgs holding group class cl com new del the sa nv ag se spon sponsored ads adr ord shs mfg'.split(' ')
);

/** «NVIDIA CORPORATION» → «nvidia»; «JPMorgan Chase & Co» → «jpmorgan chase». */
export function issuerKey(name: string): string {
	return name
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/&/g, ' ')
		.replace(/[^a-z0-9 ]+/g, ' ')
		.split(/\s+/)
		.filter((w) => w && !NOISE.has(w) && !/^[a-z]$/.test(w))
		.join(' ');
}

/** Nombre del emisor en el 13F cuando no se parece al de la barra. */
const ISSUER_NAMES: Record<string, string> = {
	AMD: 'advanced micro devices',
	TSM: 'taiwan semiconductor',
	GOOGL: 'alphabet'
};

/** Los nombres (el de la barra y el del 13F) con los que se busca un valor de la barra entre los emisores del 13F. */
export function tickerKeys(code: string): string[] {
	const t = TICKERS.find((x) => x.code === code.toUpperCase());
	if (!t) return [];
	// Sin los alias: «J.P. Morgan» quedaría en «morgan» y saldría Morgan Stanley.
	return [...new Set([ISSUER_NAMES[t.code], t.name].filter((n): n is string => !!n).map(issuerKey).filter((k) => k.length > 2))];
}

/**
 * Los emisores que son ese valor: el nombre igual, o que empieza por él seguido de otra palabra
 * («jpmorgan» → «jpmorgan chase»). Alphabet tiene dos líneas (clases A y C): salen las dos.
 */
export function issuersFor(code: string, issuers: HeldIssuer[]): HeldIssuer[] {
	const keys = tickerKeys(code);
	if (!keys.length) return [];
	return issuers.filter((e) => {
		const k = issuerKey(e.name);
		return keys.some((key) => k === key || k.startsWith(`${key} `));
	});
}


/**
 * Respaldo para las copias de funds.json de antes de HDS (sin `holders`): el índice con las 10 mayores de
 * cada fondo, que sí están. Sin el trimestre anterior, así que sin cambios.
 */
export function holdersFromTop(funds: { key: string; top: { cusip: string; name: string; value: number; shares: number; putCall?: string }[] }[]): HeldIssuer[] {
	return buildHolders(
		funds.map((f) => ({ fund: f.key, current: f.top.filter((p) => !p.putCall), previous: null })),
		Infinity
	);
}
