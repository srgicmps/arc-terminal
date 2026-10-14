// Carteras de grandes fondos según su 13F-HR en la SEC (EDGAR). Cada trimestre, los gestores con más
// de 100 millones de dólares en acciones de EE. UU. declaran sus posiciones, con hasta 45 días de plazo.
// Condiciones de la SEC (https://www.sec.gov/os/accessing-edgar-data), como en sec.ts: un User-Agent con
// nombre y correo (secreto SEC_USER_AGENT) y como mucho 10 peticiones por segundo.
// Pasos por fondo: /submissions/CIK##########.json → los dos últimos 13F-HR → índice del expediente
// (index.json) → el XML de la «information table» → posiciones.
import { XMLParser } from 'fast-xml-parser';
import type { Fund, FundMove, FundPosition, FundsData } from '../../src/lib/types.ts';
import { getJson, getText, list, num, type Source } from '../lib.ts';

const API = 'https://data.sec.gov/submissions';
const ARCHIVES = 'https://www.sec.gov/Archives/edgar/data';
/** Pausa entre peticiones: unas 6 por segundo, bien por debajo del límite de 10. */
const PAUSE_MS = 150;
/** Mayores posiciones que se guardan por fondo. */
const TOP = 10;
/** Más comprados y más vendidos que se guardan. */
const MOVES = 5;
/**
 * Desde el 3 de enero de 2023 la columna `value` va en dólares; antes, en miles de dólares
 * (https://www.sec.gov/divisions/investment/13ffaq). Se decide por la fecha de presentación.
 */
const DOLLARS_SINCE = '2023-01-03';

/** Fondos que se siguen. Los CIK se comprueban con el nombre que devuelve la SEC (ver fetch). */
export const FUNDS: { key: string; name: string; manager: string; cik: string; match: RegExp }[] = [
	{ key: 'BRK', name: 'Berkshire Hathaway', manager: 'Warren Buffett', cik: '0001067983', match: /berkshire/i },
	{ key: 'PSH', name: 'Pershing Square', manager: 'Bill Ackman', cik: '0001336528', match: /pershing/i },
	{ key: 'SCION', name: 'Scion Asset Management', manager: 'Michael Burry', cik: '0001649339', match: /scion/i },
	{ key: 'BW', name: 'Bridgewater Associates', manager: 'Ray Dalio', cik: '0001350694', match: /bridgewater/i },
	{ key: 'ARK', name: 'ARK Investment Management', manager: 'Cathie Wood', cik: '0001697748', match: /\bark\b/i },
	{ key: 'RENTEC', name: 'Renaissance Technologies', manager: 'Jim Simons (fundador)', cik: '0001037389', match: /renaissance/i }
];

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Un 13F-HR de la lista de documentos del fondo. */
export interface Filing13F {
	accession: string;
	/** Fecha de presentación. */
	filed: string;
	/** Fin del trimestre que declara (periodOfReport). */
	period: string;
}

/**
 * Los dos últimos 13F-HR de /submissions, de trimestres distintos. Las enmiendas (13F-HR/A) solo se
 * usan si no hay ningún original: muchas solo añaden unas pocas posiciones y no son la cartera entera.
 */
export function pickFilings(body: any, count = 2): Filing13F[] {
	const recent = body?.filings?.recent ?? {};
	const forms: string[] = recent.form ?? [];
	const take = (form: string) => {
		const out: Filing13F[] = [];
		for (let i = 0; i < forms.length && out.length < count; i++) {
			if (forms[i] !== form) continue;
			const filing = {
				accession: String(recent.accessionNumber?.[i] ?? ''),
				filed: String(recent.filingDate?.[i] ?? ''),
				period: String(recent.reportDate?.[i] ?? '')
			};
			if (filing.accession && !out.some((f) => f.period === filing.period)) out.push(filing);
		}
		return out;
	};
	const originals = take('13F-HR');
	return originals.length ? originals : take('13F-HR/A');
}

/** Carpeta del expediente en sec.gov/Archives. */
export const folder = (cik: string, accession: string) => `${ARCHIVES}/${Number(cik)}/${accession.replaceAll('-', '')}`;

/**
 * Nombre del XML de la information table dentro del índice del expediente. Cada gestor lo llama a su
 * manera («infotable.xml», «form13fInfoTable.xml», «46994.xml»…); el otro XML es la portada
 * (primary_doc.xml). Si hay dudas, el más grande.
 */
export function infoTableName(index: any): string | null {
	const xmls = list<any>(index?.directory?.item).filter(
		(i) => /\.xml$/i.test(String(i?.name ?? '')) && !/^primary_doc\.xml$/i.test(String(i.name))
	);
	const named = xmls.find((i) => /info.?table/i.test(String(i.name)));
	if (named) return String(named.name);
	const biggest = xmls.sort((a, b) => (num(b.size) ?? 0) - (num(a.size) ?? 0))[0];
	return biggest ? String(biggest.name) : null;
}

/** Una línea de la information table, ya agrupada por CUSIP. */
export interface Holding {
	cusip: string;
	name: string;
	value: number;
	shares: number;
	putCall?: 'Put' | 'Call';
}

const xml = new XMLParser({ ignoreAttributes: true, removeNSPrefix: true, parseTagValue: false });

/** Siglas con vocales que se dejan en mayúsculas. */
const ACRONYMS = new Set(['ETF', 'ETN', 'ADR', 'ADS', 'REIT', 'AI', 'IBM', 'AMD', 'ASML']);

/** «KRAFT HEINZ CO» → «Kraft Heinz Co»; siglas («SPDR», «S&P», «ETF») se quedan como están. */
export function issuerName(raw: string): string {
	return raw
		.trim()
		.replace(/\s+/g, ' ')
		.replace(/\s+(NEW|DEL)$/i, '')
		.split(' ')
		.map((w) => (/^[^AEIOUY]*$/i.test(w) || ACRONYMS.has(w.toUpperCase()) || /[^A-Z.,'-]/i.test(w) ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1).toLowerCase()))
		.join(' ');
}

/**
 * Lee la information table. Un mismo valor sale en varias líneas (una por gestor o tipo de discreción),
 * así que se suman por CUSIP. Las opciones (putCall) van aparte, marcadas: su `value` es el del
 * subyacente, como lo declara el fondo.
 */
export function parseInfoTable(text: string, filed: string): Holding[] {
	const doc = xml.parse(text);
	const rows = list<any>(doc?.informationTable?.infoTable);
	const scale = filed && filed < DOLLARS_SINCE ? 1000 : 1;
	const byKey = new Map<string, Holding>();
	for (const row of rows) {
		const cusip = String(row?.cusip ?? '').trim().toUpperCase();
		if (!cusip) continue;
		const pc = String(row?.putCall ?? '').trim().toLowerCase();
		const putCall = pc === 'put' ? 'Put' : pc === 'call' ? 'Call' : undefined;
		const key = putCall ? `${cusip}:${putCall}` : cusip;
		const value = (num(String(row?.value ?? '').trim()) ?? 0) * scale;
		const shares = num(String(row?.shrsOrPrnAmt?.sshPrnamt ?? '').trim()) ?? 0;
		const prev = byKey.get(key);
		if (prev) {
			prev.value += value;
			prev.shares += shares;
		} else {
			byKey.set(key, { cusip, name: issuerName(String(row?.nameOfIssuer ?? cusip)), value, shares, ...(putCall && { putCall }) });
		}
	}
	return [...byKey.values()];
}

const keyOf = (h: Holding) => (h.putCall ? `${h.cusip}:${h.putCall}` : h.cusip);

/** Las mayores posiciones, con su peso en la cartera (0–1). */
export function topPositions(holdings: Holding[], total: number, n = TOP): FundPosition[] {
	return [...holdings]
		.sort((a, b) => b.value - a.value)
		.slice(0, n)
		.map((h) => ({ ...h, weight: total ? h.value / total : 0 }));
}

/**
 * Compras y ventas frente al trimestre anterior. Se mide el cambio en acciones, valorado al precio del
 * trimestre (valor / acciones; si la posición se ha vendido entera, al del trimestre anterior): así una
 * subida de la bolsa no cuenta como compra. Ojo: un split de acciones parece una compra.
 */
export function compareQuarters(current: Holding[], previous: Holding[]): { bought: FundMove[]; sold: FundMove[] } {
	const before = new Map(previous.map((h) => [keyOf(h), h]));
	const now = new Map(current.map((h) => [keyOf(h), h]));
	const moves: FundMove[] = [];
	for (const key of new Set([...now.keys(), ...before.keys()])) {
		const cur = now.get(key);
		const old = before.get(key);
		const delta = (cur?.shares ?? 0) - (old?.shares ?? 0);
		if (!delta) continue;
		const ref = cur?.shares ? cur : old!;
		const price = ref.shares ? ref.value / ref.shares : 0;
		const base = (cur ?? old)!;
		moves.push({
			cusip: base.cusip,
			name: base.name,
			...(base.putCall && { putCall: base.putCall }),
			shares: delta,
			value: Math.round(delta * price),
			pct: old?.shares ? delta / old.shares : null,
			status: !old ? 'new' : !cur ? 'exit' : delta > 0 ? 'add' : 'trim'
		});
	}
	return {
		bought: moves.filter((m) => m.value > 0).sort((a, b) => b.value - a.value).slice(0, MOVES),
		sold: moves.filter((m) => m.value < 0).sort((a, b) => a.value - b.value).slice(0, MOVES)
	};
}

const sum = (holdings: Holding[]) => holdings.reduce((s, h) => s + h.value, 0);

export const funds: Source<FundsData> = {
	name: 'funds',
	label: 'SEC EDGAR · carteras 13F de grandes fondos',
	maxAgeMinutes: 1440,
	requires: 'SEC_USER_AGENT',
	// Unas 30 peticiones en serie, y la cartera de Renaissance son varios miles de líneas.
	deadlineMs: 180_000,
	async fetch() {
		const headers = { 'User-Agent': process.env.SEC_USER_AGENT ?? '' };
		let first = true;
		// En serie y con pausa, para respetar el límite de la SEC.
		const get = async <T>(load: () => Promise<T>) => {
			if (!first) await wait(PAUSE_MS);
			first = false;
			return load();
		};
		const holdingsOf = async (cik: string, f: Filing13F) => {
			const index = await get(() => getJson(`${folder(cik, f.accession)}/index.json`, { headers }));
			const file = infoTableName(index);
			if (!file) throw new Error(`sin information table en ${f.accession}`);
			return parseInfoTable(await get(() => getText(`${folder(cik, f.accession)}/${file}`, { headers })), f.filed);
		};

		const out: Fund[] = [];
		for (const def of FUNDS) {
			try {
				const body = await get(() => getJson(`${API}/CIK${def.cik}.json`, { headers }));
				const filer = String(body?.name ?? '');
				if (!def.match.test(filer)) console.log(`::warning::funds · ${def.key}: el CIK ${def.cik} es de «${filer}»`);
				const [last, prev] = pickFilings(body);
				if (!last) throw new Error('sin 13F-HR');
				const current = await holdingsOf(def.cik, last);
				if (!current.length) throw new Error(`13F ${last.accession} sin posiciones`);
				const previous = prev ? await holdingsOf(def.cik, prev).catch(() => null) : null;
				const total = sum(current);
				out.push({
					key: def.key,
					name: def.name,
					manager: def.manager,
					cik: def.cik,
					filer,
					period: last.period,
					filed: last.filed,
					url: `${folder(def.cik, last.accession)}/${last.accession}-index.htm`,
					total,
					count: current.length,
					top: topPositions(current, total),
					bought: [],
					sold: [],
					...(previous && { prev: { period: prev.period, total: sum(previous) }, ...compareQuarters(current, previous) })
				});
			} catch (error) {
				console.log(`  funds · ${def.key}: ${error instanceof Error ? error.message : error}`);
			}
		}
		if (!out.length) throw new Error('ningún fondo con datos');
		return { funds: out };
	}
};
