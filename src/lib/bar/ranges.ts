// Periodos, comparaciones y rentabilidad en la barra (lote 27-A): «NVDA 1a», «IBEX 5d», «NVDA vs AMD»,
// «NVDA desde 2024-01-01». Los valores van a la ficha (/s) o a CMP con el rango del gráfico de TradingView
// en ?rango=; las series («paro es 10a», «paro es vs it») se contestan en answers.ts. Lógica pura.
import { isTickerLike, norm, findCommand } from '../cmdline.ts';
import { TICKERS } from '../tickers.ts';
import { COUNTRIES } from '../countries.ts';
import { LEADERS } from '../leaders.ts';

/** Países y líderes por su nombre o alias: «trump», «rusia» no son valores aunque lo parezcan. */
// Se calcula al usarlo por primera vez: cmdline.ts importa este archivo y este usa norm() de cmdline.ts.
let names: Set<string> | null = null;
const NAMES = {
	has: (q: string) =>
		(names ??= new Set(
			[...COUNTRIES.flatMap((c) => [c.name, ...(c.aliases ?? [])]), ...LEADERS.flatMap((l) => [l.id, l.name, ...l.aliases])].map(norm)
		)).has(q)
};

/** Un rango del gráfico de TradingView: su código, cómo se dice y cuántos días cubre (aprox.). */
export interface Range {
	tv: string;
	label: string;
	days: number;
}

export const RANGES: Range[] = [
	{ tv: '1D', label: '1 día', days: 1 },
	{ tv: '5D', label: '5 días', days: 5 },
	{ tv: '1M', label: '1 mes', days: 31 },
	{ tv: '3M', label: '3 meses', days: 92 },
	{ tv: '6M', label: '6 meses', days: 183 },
	{ tv: 'YTD', label: 'en el año', days: 0 },
	{ tv: '12M', label: '1 año', days: 366 },
	{ tv: '60M', label: '5 años', days: 1827 },
	{ tv: 'ALL', label: 'todo', days: Infinity }
];

/** ¿Es un código de rango válido para ?rango=? */
export const isRange = (v: string) => RANGES.some((r) => r.tv === v);

/** «12M» → «1 año». */
export const rangeLabel = (tv: string) => RANGES.find((r) => r.tv === tv)?.label ?? tv;

/** Velas que tocan a cada rango: de 5 min en un día, semanales en 5 años o más; si no, diarias. */
export const rangeInterval = (tv: string) => ({ '1D': '5', '5D': '30', '60M': 'W', ALL: 'W' })[tv] ?? 'D';

/**
 * «1a», «5d», «3m», «6 meses», «ytd», «max» → su rango, y los años o días pedidos (para las series:
 * «10a» no es un rango del gráfico, pero sí un periodo). null si no es un periodo.
 */
export function parsePeriod(raw: string): { range: Range; days: number } | null {
	const q = norm(raw).replace(/\s+/g, '');
	// Los códigos de TradingView tal cual («60M», «12M»): así vuelven igual desde el historial.
	const exact = RANGES.find((r) => r.tv === q);
	if (exact) return { range: exact, days: exact.days };
	if (/^(YTD|ANO|ESTEANO|ENELANO)$/.test(q)) return { range: RANGES[5], days: 0 };
	if (/^(MAX|TODO|ALL)$/.test(q)) return { range: RANGES[8], days: Infinity };
	const m = q.match(/^(\d{1,2})(D|DIA|DIAS|S|SEM|SEMANA|SEMANAS|M|MES|MESES|A|ANO|ANOS|Y)$/);
	if (!m) return null;
	const n = Number(m[1]);
	if (!n) return null;
	const unit = m[2][0];
	const days = unit === 'D' ? n : unit === 'S' ? n * 7 : unit === 'M' ? Math.round(n * 30.5) : Math.round(n * 365.25);
	// El rango del gráfico: el más corto que lo cubre.
	const range = RANGES.filter((r) => r.tv !== 'YTD').find((r) => r.days >= days) ?? RANGES[8];
	return { range, days };
}

/** ¿La palabra es un valor? Uno conocido (o su alias), o un código con bolsa delante; nunca un comando. */
export function symbolOf(raw: string): string | null {
	const q = norm(raw);
	const known = TICKERS.find((t) => t.code === q || t.aliases?.some((a) => norm(a) === q));
	if (known) return known.code;
	if (findCommand(q) || !isTickerLike(q) || NAMES.has(q)) return null;
	return /[:.]/.test(q) || /^[A-Z]{1,5}$/.test(q) ? q : null;
}

/** Lo que abre la barra para un valor con periodo o una comparación. */
export interface ChartTarget {
	route: '/s' | '/cmp';
	search: string;
	code: string;
	desc: string;
}

/** «NVDA 1a», «IBEX 5d»: la ficha con el gráfico en ese rango. */
export function symbolRange(raw: string): ChartTarget | null {
	const m = raw.trim().match(/^(\S+)\s+(.+)$/);
	if (!m) return null;
	const period = parsePeriod(m[2]);
	const sym = period ? symbolOf(m[1]) : null;
	if (!period || !sym) return null;
	const name = TICKERS.find((t) => t.code === sym)?.name ?? sym;
	return {
		route: '/s',
		search: `?sym=${encodeURIComponent(sym)}&rango=${period.range.tv}`,
		code: `${sym} ${period.range.tv}`,
		desc: `Gráfico de ${name}, ${period.range.label}`
	};
}

/** «NVDA vs AMD», «NVDA vs AMD vs AVGO 5a»: CMP con esos valores (y el rango, si lo hay). */
export function compareInput(raw: string): ChartTarget | null {
	let parts = raw.trim().split(/\s+(?:vs\.?|versus|contra|frente a)\s+/i);
	// El periodo, si lo hay, va detrás del último: «AMD 1a».
	let period: ReturnType<typeof parsePeriod> = null;
	const tail = parts[parts.length - 1].split(/\s+/);
	if (tail.length === 2 && (period = parsePeriod(tail[1]))) parts = [...parts.slice(0, -1), tail[0]];
	if (parts.length < 2) return null;
	const syms = parts.map((p) => (p.includes(' ') ? null : symbolOf(p)));
	if (syms.length < 2 || syms.some((s) => !s)) return null;
	// Al menos uno tiene que ser un valor conocido (o con bolsa): «otan vs rusia» es texto, no una comparación.
	if (!syms.some((s) => /[:.]/.test(s!) || TICKERS.some((t) => t.code === s))) return null;
	const codes = [...new Set(syms as string[])].slice(0, 5);
	const rango = period ? `&rango=${period.range.tv}` : '';
	return {
		route: '/cmp',
		search: `?s=${encodeURIComponent(codes.join(' '))}${rango}`,
		code: 'CMP',
		desc: `Comparar ${codes.join(', ')}${period ? `, ${period.range.label}` : ''}`
	};
}

/** «NVDA desde 2024-01-01» (o «desde 1/1/2024»): el valor y el día. */
export function sinceInput(raw: string): { sym: string; date: string } | null {
	const m = raw.trim().match(/^(\S+)\s+desde\s+(\d{4})-(\d{1,2})-(\d{1,2})$|^(\S+)\s+desde\s+(\d{1,2})\/(\d{1,2})\/(\d{4})$/i);
	if (!m) return null;
	const sym = symbolOf(m[1] ?? m[5]);
	const [y, mo, d] = m[1] ? [m[2], m[3], m[4]] : [m[8], m[7], m[6]];
	const date = `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
	return sym && !Number.isNaN(Date.parse(`${date}T12:00:00Z`)) ? { sym, date } : null;
}

/** El rango del gráfico que cubre desde `date` hasta hoy. */
export function rangeSince(date: string, now: number): Range {
	const days = (now - Date.parse(`${date}T12:00:00Z`)) / 86_400_000;
	return RANGES.filter((r) => r.tv !== 'YTD').find((r) => r.days >= days) ?? RANGES[8];
}
