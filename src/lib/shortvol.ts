// Volumen en corto diario de FINRA (Reg SHO, archivo consolidado CNMS): qué parte del volumen del día se
// vendió en corto. Lo descarga scripts/sources/finra.ts; aquí, el formato y las cuentas que usan las vistas
// (/s y MIS). Provisional (lote 24.4, D35): para quitarlo, este archivo, su test, la fuente, el componente
// ShortVolume.svelte y las pocas líneas que lo usan en /s y MIS.
import { TICKERS, tvSymbol } from './tickers.ts';

/** Lo que guarda static/data/finra.json. */
export interface FinraData {
	/** Días de mercado con archivo de FINRA, de más antiguo a más reciente (AAAA-MM-DD), hasta 20. */
	dates: string[];
	/** Último día: [volumen en corto, volumen total], en acciones redondeadas. */
	rows: Record<string, [number, number]>;
	/** Proporción en corto de cada día, en décimas de % (523 = 52,3 %), alineada con `dates`; null si ese día no hay. */
	ratios: Record<string, (number | null)[]>;
}

/** Lo que llega a la vista: el último día y la media, por valor. [corto, total, media de 20 días en décimas de %]. */
export interface ShortSummary {
	date: string;
	/** Días que entran en la media (hasta 20). */
	days: number;
	rows: Record<string, [number, number, number | null]>;
}

/** Lo que pinta el panel de un valor. */
export interface ShortStat {
	date: string;
	/** % del volumen del día vendido en corto. */
	ratio: number;
	/** Media de los últimos días (con hoy), en %; null si hay pocos días. */
	avg: number | null;
	/** Diferencia con la media, en puntos; null si no hay media. */
	diff: number | null;
	short: number;
	total: number;
	days: number;
}

/** Días que se guardan y entran en la media. */
export const KEEP_DAYS = 20;
/** Con menos días que estos, no se da media. */
export const MIN_DAYS = 5;

/** Proporción en corto en % (ShortVolume / TotalVolume); null si no hay volumen. */
export function shortRatio(short: number, total: number): number | null {
	return total > 0 && short >= 0 ? (short / total) * 100 : null;
}

/** Media (en décimas de %) de los días con dato; null si hay menos de MIN_DAYS. */
export function average(ratios: (number | null)[], min = MIN_DAYS): number | null {
	const ok = ratios.filter((r): r is number => r !== null);
	return ok.length >= min ? Math.round(ok.reduce((s, r) => s + r, 0) / ok.length) : null;
}

/** Recorte para las vistas: el último día y la media de cada valor, sin el historial. */
export function summarize(d: FinraData): ShortSummary {
	const rows: ShortSummary['rows'] = {};
	for (const [sym, [short, total]] of Object.entries(d.rows)) rows[sym] = [short, total, average(d.ratios[sym] ?? [])];
	return { date: d.dates.at(-1) ?? '', days: d.dates.length, rows };
}

/** Bolsas de EE. UU. en los símbolos de TradingView. */
const US = /^(NASDAQ|NYSE|AMEX|NYSEARCA|ARCA|BATS|CBOE):(.+)$/;

/**
 * Símbolo de FINRA para un código de la barra o de MIS: «NVDA» y «NASDAQ:NVDA» → «NVDA». null si cotiza fuera de
 * EE. UU. («SAN» es Santander en Madrid, aunque en EE. UU. haya un SAN) o es un índice, una divisa…
 */
export function finraSymbol(code: string): string | null {
	const tv = tvSymbol(code);
	const m = US.exec(tv);
	if (m) return m[2];
	return tv.includes(':') ? null : tv;
}

/** Valores de la barra que cotizan en EE. UU., con su símbolo de FINRA (los que siempre se guardan). */
export const US_TICKERS = TICKERS.map((t) => US.exec(t.tv)?.[2]).filter((s): s is string => !!s);

/** El dato de un valor, o null si FINRA no lo trae. */
export function shortStat(s: ShortSummary | null | undefined, code: string): ShortStat | null {
	const sym = finraSymbol(code);
	const row = sym ? s?.rows[sym] : undefined;
	if (!s || !row) return null;
	const [short, total, avg10] = row;
	const ratio = shortRatio(short, total);
	if (ratio === null) return null;
	const avg = avg10 === null ? null : avg10 / 10;
	return { date: s.date, ratio, avg, diff: avg === null ? null : ratio - avg, short, total, days: s.days };
}
