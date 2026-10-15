// CARTERA (F8): tus posiciones, lo que valen hoy, lo que ganas o pierdes y el reparto. Lógica pura: la vista
// le pasa las cotizaciones que haya y los cambios del BCE. Las posiciones son del usuario: se guardan en su
// navegador (arc-portfolio) y, con cuenta, en sus ajustes privados (D1). Nunca en el repo ni en static/data.
import { convert, type FxRate } from './fx.ts';
import type { Quote } from './types.ts';

export const PORTFOLIO_KEY = 'arc-portfolio';
/** Tope de posiciones: cabe de sobra en los 64 KB por clave de los ajustes en la nube. */
export const MAX_POSITIONS = 100;

export interface Position {
	/** Código tal como lo escribe el usuario, en mayúsculas: «NVDA», «SAN.MC», «BRK.B». */
	sym: string;
	qty: number;
	/** Precio medio de compra, en `cur`. */
	cost: number;
	/** Divisa en la que cotiza (USD, EUR, GBP…). */
	cur: string;
	/** Precio puesto a mano, para lo que Finnhub no da. Manda sobre la cotización solo si no la hay. */
	price?: number;
	sector?: string;
}

const SYM = /^[A-Z0-9][A-Z0-9.\-:]{0,19}$/;
const CUR = /^[A-Z]{3}$/;
const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v);

/** Una posición válida (o null): símbolo y divisa con forma de código, cantidad y coste positivos. */
export function cleanPosition(raw: unknown): Position | null {
	if (!raw || typeof raw !== 'object') return null;
	const r = raw as Record<string, unknown>;
	const sym = typeof r.sym === 'string' ? r.sym.trim().toUpperCase() : '';
	const cur = typeof r.cur === 'string' ? r.cur.trim().toUpperCase() : '';
	if (!SYM.test(sym) || !CUR.test(cur) || !num(r.qty) || !num(r.cost) || (r.qty as number) <= 0 || (r.cost as number) < 0) return null;
	const p: Position = { sym, qty: r.qty as number, cost: r.cost as number, cur };
	if (num(r.price) && (r.price as number) > 0) p.price = r.price as number;
	if (typeof r.sector === 'string' && r.sector.trim()) p.sector = r.sector.trim().slice(0, 40);
	return p;
}

/** Lo guardado en arc-portfolio, sin lo que no valga. */
export function parsePortfolio(text: string | null): Position[] {
	try {
		const data: unknown = JSON.parse(text ?? '[]');
		return Array.isArray(data) ? data.map(cleanPosition).filter((p): p is Position => p !== null).slice(0, MAX_POSITIONS) : [];
	} catch {
		return [];
	}
}

/** Finnhub usa el símbolo de EE. UU. sin bolsa: «NASDAQ:NVDA» → «NVDA». */
const bare = (sym: string) => sym.split(':').pop()!;

export interface Row extends Position {
	/** Precio de hoy en su divisa, y de dónde sale. */
	now: number | null;
	source: 'finnhub' | 'manual' | null;
	changePct: number | null;
	/** En euros. */
	value: number | null;
	invested: number | null;
	gain: number | null;
	gainPct: number | null;
	/** Peso en la cartera (de lo que tiene precio), en %. */
	weight: number | null;
}

export interface Summary {
	rows: Row[];
	value: number;
	invested: number;
	gain: number;
	gainPct: number | null;
	/** Posiciones sin precio (ni de Finnhub ni a mano) o sin cambio de su divisa: no suman. */
	missing: string[];
	bySector: { name: string; value: number; pct: number }[];
	byCurrency: { name: string; value: number; pct: number }[];
}

/** Valora la cartera en euros con las cotizaciones y los cambios que haya. */
export function summarize(positions: Position[], quotes: Quote[], rates: Map<string, FxRate>): Summary {
	const bySym = new Map(quotes.map((q) => [q.symbol.toUpperCase(), q]));
	const rows: Row[] = positions.map((p) => {
		const q = bySym.get(bare(p.sym));
		// La cotización de Finnhub va en dólares: solo vale para posiciones en USD.
		const live = q && p.cur === 'USD' ? q.price : null;
		const now = live ?? p.price ?? null;
		const eur = (v: number) => (p.cur === 'EUR' ? v : convert(v, p.cur, 'EUR', rates));
		const value = now === null ? null : eur(now * p.qty);
		const invested = eur(p.cost * p.qty);
		const gain = value !== null && invested !== null ? value - invested : null;
		return {
			...p,
			now,
			source: live !== null ? 'finnhub' : now !== null ? 'manual' : null,
			changePct: live !== null ? (q?.changePct ?? null) : null,
			value,
			invested,
			gain,
			gainPct: gain !== null && invested ? (gain / invested) * 100 : null,
			weight: null
		};
	});
	const priced = rows.filter((r) => r.value !== null && r.invested !== null);
	const value = priced.reduce((s, r) => s + r.value!, 0);
	const invested = priced.reduce((s, r) => s + r.invested!, 0);
	for (const r of priced) r.weight = value ? (r.value! / value) * 100 : null;
	const group = (key: (r: Row) => string) => {
		const m = new Map<string, number>();
		for (const r of priced) m.set(key(r), (m.get(key(r)) ?? 0) + r.value!);
		return [...m].map(([name, v]) => ({ name, value: v, pct: value ? (v / value) * 100 : 0 })).sort((a, b) => b.value - a.value);
	};
	return {
		rows,
		value,
		invested,
		gain: value - invested,
		gainPct: invested ? ((value - invested) / invested) * 100 : null,
		missing: rows.filter((r) => r.value === null || r.invested === null).map((r) => r.sym),
		bySector: group((r) => r.sector ?? 'Sin sector'),
		byCurrency: group((r) => r.cur)
	};
}

/**
 * Número escrito a la española o a la inglesa: «1,5» y «1.5» → 1,5; «1.500» → 1500 (punto de miles);
 * «1.234,56» → 1234,56. Vacío o no numérico → NaN.
 */
export function parseDecimal(text: string): number {
	let t = text.trim().replace(/\s/g, '');
	if (!t) return NaN;
	if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
	else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
	return /^-?\d*\.?\d+$/.test(t) ? Number(t) : NaN;
}
