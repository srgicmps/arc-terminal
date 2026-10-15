// Centro de mando (Arc OS 6): el grafo de entidades, sin DOM ni Svelte, para probarlo.
// Nodos: países, líderes, bancos centrales y valores (los registros fijos de la terminal) y, además, lo que
// traen los datos: sanciones (OFAC, USTR, BIS, ITA y OFSI), sucesos (GDACS) y temas de IMP.
// Aristas, con peso: dos entidades en el mismo titular (co-mención), el país de un líder o de un valor, el
// banco central de un país, el país de una sanción o de un suceso y las entidades de un tema de IMP.
// Cada nodo guarda también sus «referencias» (titulares, sanciones, sucesos), que son la cronología del Expediente.
import { BANKS, type Bank } from '../../../meetings.ts';
import { COUNTRIES, countryByName, findCountries } from '../../../countries.ts';
import { LEADERS } from '../../../leaders.ts';
import { namePattern, names, plain } from '../../../news.ts';
import { fold } from '../../../search.ts';
import { TICKERS, type Ticker } from '../../../tickers.ts';
import type { GdacsEvent, ImpCurrent, ImpData, ImpEntry, NewsItem, TradeDoc } from '../../../types.ts';

export type Kind = 'country' | 'leader' | 'bank' | 'ticker' | 'sanction' | 'event' | 'story';

export const KINDS: { value: Kind; label: string; one: string }[] = [
	{ value: 'country', label: 'Países', one: 'País' },
	{ value: 'leader', label: 'Líderes', one: 'Líder' },
	{ value: 'bank', label: 'Bancos', one: 'Banco central' },
	{ value: 'ticker', label: 'Valores', one: 'Valor' },
	{ value: 'sanction', label: 'Sanciones', one: 'Sanción' },
	{ value: 'event', label: 'Sucesos', one: 'Suceso' },
	{ value: 'story', label: 'Temas', one: 'Tema de IMP' }
];
export const kindLabel = (k: Kind) => KINDS.find((x) => x.value === k)?.one ?? k;
export const isKind = (k: string): k is Kind => KINDS.some((x) => x.value === k);

/** Por qué están enlazadas dos entidades. */
export type Why = 'co' | 'pais' | 'banco' | 'cargo' | 'sancion' | 'suceso' | 'tema';
export const WHY: Record<Why, string> = {
	co: 'en los mismos titulares',
	pais: 'país',
	banco: 'banco central',
	cargo: 'cargo',
	sancion: 'sanción',
	suceso: 'suceso',
	tema: 'tema de IMP'
};

export interface IntelNode {
	/** «country:ES», «leader:trump», «ticker:NVDA»… */
	id: string;
	kind: Kind;
	/** Lo que va tras «kind:» (código, id o clave del dato). */
	key: string;
	label: string;
	/** Una línea de contexto: cargo, bolsa, organismo… */
	sub: string;
	/** Ubicación [lat, lon], si la tiene. */
	at?: [number, number];
	/** Titulares que la nombran. */
	mentions: number;
	/** Fecha del dato (sanción, suceso, tema), «AAAA-MM-DD». */
	date?: string;
	url?: string;
	/** Nombres para el buscador, ya sin tildes y en minúscula. */
	terms: string;
}

export interface IntelEdge {
	a: string;
	b: string;
	w: number;
	/** Cuántas veces se ha enlazado por cada motivo (lo que enseña whyText). */
	why: Partial<Record<Why, number>>;
	/** El peso que aporta cada motivo (la arista BCE↔país pesa 1 y la Fed↔EE. UU., 2). */
	ws: Partial<Record<Why, number>>;
}

/** Algo con fecha que nombra una entidad: va a su cronología. */
export interface IntelRef {
	kind: 'news' | 'imp' | 'sanction' | 'event';
	title: string;
	url: string;
	source: string;
	/** ISO 8601 o «AAAA-MM-DD». */
	time: string | null;
}

export interface Graph {
	nodes: Map<string, IntelNode>;
	edges: Map<string, IntelEdge>;
	/** Vecinos de cada nodo: id → (id del vecino → arista). */
	adj: Map<string, Map<string, IntelEdge>>;
	refs: Map<string, IntelRef[]>;
}

export interface IntelInput {
	news?: (NewsItem & { section?: string })[];
	imp?: ImpData | null;
	sanctions?: TradeDoc[];
	events?: GdacsEvent[];
}

export const nodeId = (kind: Kind, key: string) => `${kind}:${key}`;
export const edgeKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/** Bolsa de TradingView → país. Los índices, divisas, cripto y materias primas no tienen país. */
const EXCHANGE: Record<string, string> = { NASDAQ: 'US', NYSE: 'US', AMEX: 'US', SP: 'US', BME: 'ES', XETR: 'DE', EURONEXT: 'FR', MIL: 'IT', OMXSTO: 'SE' };
/** Excepciones: la sede no es la de la bolsa. */
const TICKER_COUNTRY: Record<string, string | null> = { TSM: 'TW', ASML: 'NL', BAES: 'GB' };

export const exchangeOf = (t: Ticker) => t.tv.split(':')[0];
export function tickerCountry(t: Ticker): string | null {
	if (t.code in TICKER_COUNTRY) return TICKER_COUNTRY[t.code];
	return EXCHANGE[exchangeOf(t)] ?? null;
}
/** Los ETF repiten el nombre de su índice («S&P 500 (ETF)»): no se buscan en los titulares. */
const isEtf = (t: Ticker) => /\(ETF\)/.test(t.name);

/** Otros nombres de cada banco central (como en entities.ts). */
const BANK_ALIASES: Record<Bank, string[]> = {
	ecb: ['ECB', 'European Central Bank'],
	fed: ['Federal Reserve', 'Reserva Federal de EE. UU.', 'FOMC']
};
/** Institución → banco central, para el cargo de un líder («Presidenta · Banco Central Europeo»). */
const bankByName = (name: string): Bank | undefined =>
	(Object.keys(BANKS) as Bank[]).find((b) => [BANKS[b].long, BANKS[b].name].some((n) => fold(n) === fold(name)));

/** Dónde está cada líder: un país o un banco central (por la parte del cargo tras «·»). */
export function leaderPlace(role: string): string | null {
	const place = role.split('·').at(-1)?.trim() ?? '';
	const bank = bankByName(place);
	if (bank) return nodeId('bank', bank);
	const c = countryByName(place);
	return c ? nodeId('country', c.code) : null;
}

/** Organismo que sanciona → país que sanciona. */
const ISSUER: Record<string, string> = { OFAC: 'US', USTR: 'US', BIS: 'US', ITA: 'US', OFSI: 'GB' };

/** Las entidades fijas: países, líderes, bancos y valores, con sus enlaces de estructura. */
function base(): Graph {
	const g: Graph = { nodes: new Map(), edges: new Map(), adj: new Map(), refs: new Map() };
	for (const c of COUNTRIES)
		addNode(g, {
			kind: 'country',
			key: c.code,
			label: c.name,
			sub: `${c.code} · ${c.currency}${c.euro ? ' · euro' : ''}`,
			at: c.center,
			names: [c.name, c.code, c.iso3, ...(c.aliases ?? [])]
		});
	for (const b of Object.keys(BANKS) as Bank[]) addNode(g, { kind: 'bank', key: b, label: BANKS[b].name, sub: BANKS[b].long, names: [BANKS[b].long, ...BANK_ALIASES[b]] });
	for (const l of LEADERS) addNode(g, { kind: 'leader', key: l.id, label: l.name, sub: l.role, names: l.aliases });
	for (const t of TICKERS) addNode(g, { kind: 'ticker', key: t.code, label: t.name, sub: `${t.code} · ${exchangeOf(t)}`, names: [t.code, ...(t.aliases ?? [])] });

	for (const l of LEADERS) {
		const p = leaderPlace(l.role);
		if (p) link(g, nodeId('leader', l.id), p, 2, 'cargo');
	}
	for (const c of COUNTRIES) if (c.euro) link(g, nodeId('bank', 'ecb'), nodeId('country', c.code), 1, 'banco');
	link(g, nodeId('bank', 'fed'), nodeId('country', 'US'), 2, 'banco');
	for (const t of TICKERS) {
		const c = tickerCountry(t);
		if (c && g.nodes.has(nodeId('country', c))) link(g, nodeId('ticker', t.code), nodeId('country', c), 1, 'pais');
	}
	return g;
}

function addNode(g: Graph, n: Omit<IntelNode, 'id' | 'mentions' | 'terms'> & { names?: string[] }): IntelNode {
	const id = nodeId(n.kind, n.key);
	const { names: extra = [], ...rest } = n;
	const node: IntelNode = { ...rest, id, mentions: 0, terms: fold([n.label, ...extra].join(' | ')) };
	g.nodes.set(id, node);
	return node;
}

/** Suma `w` a la arista entre a y b (la crea si no está). */
export function link(g: Graph, a: string, b: string, w: number, why: Why) {
	if (a === b || !g.nodes.has(a) || !g.nodes.has(b)) return;
	const k = edgeKey(a, b);
	let e = g.edges.get(k);
	if (!e) {
		e = { a: a < b ? a : b, b: a < b ? b : a, w: 0, why: {}, ws: {} };
		g.edges.set(k, e);
		for (const [x, y] of [[a, b], [b, a]]) {
			if (!g.adj.has(x)) g.adj.set(x, new Map());
			g.adj.get(x)!.set(y, e);
		}
	}
	e.w += w;
	e.why[why] = (e.why[why] ?? 0) + 1;
	e.ws[why] = (e.ws[why] ?? 0) + w;
}

function addRef(g: Graph, id: string, ref: IntelRef) {
	const list = g.refs.get(id) ?? [];
	if (list.some((r) => r.url === ref.url && r.title === ref.title)) return;
	list.push(ref);
	g.refs.set(id, list);
}

// Expresiones de los nombres con nodo: se compilan la primera vez que hacen falta.
let patterns: { id: string; re: RegExp[] }[] | undefined;
function compile() {
	return [
		...TICKERS.filter((t) => !isEtf(t)).map((t) => ({ id: nodeId('ticker', t.code), re: names(t).map(namePattern) })),
		...LEADERS.map((l) => ({ id: nodeId('leader', l.id), re: [namePattern(l.name.split(' ').at(-1) ?? l.name)] })),
		...(Object.keys(BANKS) as Bank[]).map((b) => ({
			id: nodeId('bank', b),
			re: [BANKS[b].name, BANKS[b].long, ...BANK_ALIASES[b]].map(namePattern)
		}))
	];
}

/** Los nodos fijos que nombra un texto (valores, líderes, bancos y países), sin repetir. */
export function entityIdsIn(text: string): string[] {
	patterns ??= compile();
	const t = plain(text);
	const found = patterns.filter((p) => p.re.some((re) => re.test(t))).map((p) => p.id);
	for (const c of findCountries(text)) found.push(nodeId('country', c.code));
	return [...new Set(found)];
}

const titleOf = (x: { title: string; titleEs?: string }) => x.titleEs || x.title;

/** El grafo entero a partir de los datos (los que falten, se quedan sin nodos ni aristas). */
export function buildGraph(input: IntelInput): Graph {
	const g = base();

	// Titulares: cada par de entidades del mismo titular suma 1.
	const seen = new Set<string>();
	for (const item of input.news ?? []) {
		const k = item.url || item.title;
		if (!k || seen.has(k)) continue;
		seen.add(k);
		const ids = entityIdsIn(`${item.title} ${item.titleEs ?? ''}`);
		const ref: IntelRef = { kind: 'news', title: titleOf(item), url: item.url, source: item.source, time: item.time };
		for (const id of ids) {
			g.nodes.get(id)!.mentions++;
			addRef(g, id, ref);
		}
		for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) link(g, ids[i], ids[j], 1, 'co');
	}

	// Temas de IMP: el top de ahora y el de hoy, sin repetir. Pesan según su puntuación.
	const imp = input.imp;
	if (imp) {
		const today = imp.days.find((d) => d.date === imp.date)?.items ?? [];
		const topics = new Map<string, ImpEntry | ImpCurrent>();
		for (const e of [...imp.current.slice(0, 15), ...today]) if (!topics.has(e.k)) topics.set(e.k, e);
		const max = Math.max(1, ...[...topics.values()].map((e) => e.score));
		for (const e of topics.values()) {
			const ids = entityIdsIn(`${e.title} ${e.titleEs ?? ''}`);
			if (!ids.length) continue;
			const time = 'time' in e && e.time ? e.time : imp.date;
			const story = addNode(g, { kind: 'story', key: e.k, label: titleOf(e), sub: `IMP · ${e.sources.length} medios · ${Math.round(e.score)} puntos`, date: imp.date, url: e.url });
			const ref: IntelRef = { kind: 'imp', title: titleOf(e), url: e.url, source: `IMP · ${e.sources.slice(0, 3).join(', ')}`, time };
			addRef(g, story.id, ref);
			for (const id of ids) {
				link(g, story.id, id, 1 + (2 * e.score) / max, 'tema');
				addRef(g, id, ref);
			}
		}
	}

	// Sanciones: solo las que nombran algún país (además del que sanciona).
	for (const d of input.sanctions ?? []) {
		const issuer = ISSUER[d.agency];
		const targets = findCountries(`${d.title} ${d.abstract}`).filter((c) => c.code !== issuer);
		if (!targets.length) continue;
		const n = addNode(g, { kind: 'sanction', key: d.id, label: d.title, sub: `${d.agency} · ${d.topic}`, date: d.date, url: d.url, names: [d.agency, d.topic] });
		const ref: IntelRef = { kind: 'sanction', title: d.title, url: d.url, source: `${d.agency} · ${d.topic}`, time: d.date };
		addRef(g, n.id, ref);
		for (const c of targets) {
			link(g, n.id, nodeId('country', c.code), 2, 'sancion');
			addRef(g, nodeId('country', c.code), ref);
		}
		if (issuer) link(g, n.id, nodeId('country', issuer), 1, 'sancion');
	}

	// Sucesos (GDACS): su país, por el nombre que da GDACS.
	for (const e of input.events ?? []) {
		const at: [number, number] | undefined = e.lat != null && e.lon != null ? [e.lat, e.lon] : undefined;
		const n = addNode(g, {
			kind: 'event',
			key: e.id,
			label: e.name,
			sub: `${e.kind} · alerta ${e.level === 'red' ? 'roja' : 'naranja'}${e.country ? ` · ${e.country}` : ''}`,
			at,
			date: (e.from ?? e.updated ?? '').slice(0, 10) || undefined,
			url: e.url,
			names: [e.kind, e.country]
		});
		const ref: IntelRef = { kind: 'event', title: `${e.kind}: ${e.name}`, url: e.url, source: `GDACS · ${e.severity}`, time: e.from ?? e.updated };
		addRef(g, n.id, ref);
		const cs = [countryByName(e.country), ...findCountries(e.country)].filter((c) => c !== undefined);
		for (const c of new Set(cs)) {
			link(g, n.id, nodeId('country', c.code), 2, 'suceso');
			addRef(g, nodeId('country', c.code), ref);
		}
	}

	for (const list of g.refs.values()) list.sort((a, b) => (b.time ?? '').localeCompare(a.time ?? ''));
	return g;
}
