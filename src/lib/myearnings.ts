// Tus próximos resultados: el calendario de resultados de Finnhub (grandes empresas de EE. UU., próximas
// 2 semanas) cruzado con tu lista MIS. Funciones puras: las usan MIS y la portada.
import { dm } from './format.ts';
import type { Earnings } from './types.ts';

export interface MyEarnings {
	/** El código tal como está en tu lista: «NVDA», «NASDAQ:NVDA»… */
	code: string;
	symbol: string;
	date: string;
	hour: string;
}

const HOUR: Record<string, string> = {
	bmo: 'antes de la apertura',
	amc: 'tras el cierre',
	dmh: 'durante la sesión'
};

/** «NASDAQ:NVDA» → «NVDA». Finnhub usa el símbolo de EE. UU. sin bolsa. */
const bare = (code: string) => code.split(':').pop()!.trim().toUpperCase();

/** Resultados de hoy en adelante de los valores de tu lista, por fecha. */
export function myEarnings(earnings: Earnings[], codes: string[], today: string): MyEarnings[] {
	const mine = new Map(codes.map((c) => [bare(c), c]));
	return earnings
		.filter((e) => e.date >= today && mine.has(e.symbol.toUpperCase()))
		.map((e) => ({ code: mine.get(e.symbol.toUpperCase())!, symbol: e.symbol, date: e.date, hour: e.hour }))
		.sort((a, b) => a.date.localeCompare(b.date) || a.symbol.localeCompare(b.symbol));
}

/** «NVDA · resultados 19 nov, tras el cierre» (o «hoy» / «mañana»). */
export function earningsLine(e: MyEarnings, today: string): string {
	const days = Math.round((Date.parse(`${e.date}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000);
	const when = days === 0 ? 'hoy' : days === 1 ? 'mañana' : dm(`${e.date}T12:00:00Z`);
	return `${e.symbol} · resultados ${when}${HOUR[e.hour] ? `, ${HOUR[e.hour]}` : ''}`;
}
