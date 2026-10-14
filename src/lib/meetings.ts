// Reuniones de política monetaria del BCE y de la Fed: cuándo es la próxima y qué descuenta Polymarket.
//
// Fechas del día de la decisión (el segundo día de cada reunión), según los calendarios oficiales:
// - BCE: https://www.ecb.europa.eu/press/calendars/mgcgc/html/index.en.html
//   Decisión a las 14:15 (hora de Fráncfort) y rueda de prensa a las 14:45.
// - Fed: https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm
//   Decisión a las 14:00 de Washington (20:00 en España). `sep`: publica proyecciones económicas.
// Las de 2027 las anunciaron ambos bancos como provisionales. Revisar cada año, cuando publiquen el siguiente.
import type { Prediction } from './types.ts';

export type Bank = 'ecb' | 'fed';

export interface Meeting {
	bank: Bank;
	/** Día de la decisión: «2026-10-29». */
	date: string;
	/** Fed: reunión con proyecciones económicas (SEP). */
	sep?: boolean;
}

/** `of`: «del BCE», «de la Fed». */
export const BANKS: Record<Bank, { name: string; of: string; long: string; url: string }> = {
	ecb: {
		name: 'BCE',
		of: 'del BCE',
		long: 'Banco Central Europeo',
		url: 'https://www.ecb.europa.eu/press/calendars/mgcgc/html/index.en.html'
	},
	fed: {
		name: 'Fed',
		of: 'de la Fed',
		long: 'Reserva Federal',
		url: 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm'
	}
};

const ECB = [
	'2026-02-05', '2026-03-19', '2026-04-30', '2026-06-11', '2026-07-23', '2026-09-10', '2026-10-29', '2026-12-17',
	'2027-02-04', '2027-03-18', '2027-04-29', '2027-06-10', '2027-07-22', '2027-09-09', '2027-10-28', '2027-12-16'
];

const FED: [string, boolean][] = [
	['2026-01-28', false], ['2026-03-18', true], ['2026-04-29', false], ['2026-06-17', true],
	['2026-07-29', false], ['2026-09-16', true], ['2026-10-28', false], ['2026-12-09', true],
	['2027-01-27', false], ['2027-03-17', true], ['2027-04-28', false], ['2027-06-09', true],
	['2027-07-28', false], ['2027-09-15', true], ['2027-10-27', false], ['2027-12-08', true]
];

/** Todas las reuniones, por fecha. */
export const MEETINGS: Meeting[] = [
	...ECB.map((date): Meeting => ({ bank: 'ecb', date })),
	...FED.map(([date, sep]): Meeting => ({ bank: 'fed', date, sep }))
].sort((a, b) => a.date.localeCompare(b.date));

const fmtDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' });
/** Fecha de hoy en Madrid: «2026-10-14». */
export const madridDate = (now: number) => fmtDate.format(new Date(now));

/** Días que faltan de `today` a `date` (las dos «AAAA-MM-DD»). */
export function daysBetween(today: string, date: string): number {
	return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}

/** «hoy», «mañana», «en 15 días». */
export function inDays(n: number): string {
	if (n === 0) return 'hoy';
	if (n === 1) return 'mañana';
	return `en ${n} días`;
}

/** Reuniones desde hoy (incluida la de hoy), de la más cercana a la más lejana. */
export function upcoming(today: string, bank?: Bank): Meeting[] {
	return MEETINGS.filter((m) => m.date >= today && (!bank || m.bank === bank));
}

/** Probabilidades de Polymarket para una reunión, agrupadas en mantener, subir y bajar (0–1). */
export interface MeetingOdds {
	hold: number;
	hike: number;
	cut: number;
	url: string;
}

const MONTHS_EN = [
	'january', 'february', 'march', 'april', 'may', 'june',
	'july', 'august', 'september', 'october', 'november', 'december'
];
const BANK_RE: Record<Bank, RegExp> = {
	ecb: /\becb\b|european central bank/i,
	fed: /\bfed\b|\bfomc\b|federal reserve/i
};

/**
 * Busca el mercado de Polymarket de esa reunión («Fed decision in October?»): tiene que nombrar al banco
 * y el mes de la reunión, o cerrar como mucho 3 días antes o después. Devuelve null si no hay ninguno
 * o si sus opciones no se pueden leer como mantener / subir / bajar.
 */
export function meetingOdds(meeting: Meeting, markets: Prediction[]): MeetingOdds | null {
	const month = MONTHS_EN[Number(meeting.date.slice(5, 7)) - 1];
	const market = markets.find((p) => {
		if (!BANK_RE[meeting.bank].test(p.title)) return false;
		if (p.title.toLowerCase().includes(month)) return true;
		const end = p.endDate.slice(0, 10);
		return /^\d{4}-\d{2}-\d{2}$/.test(end) && Math.abs(daysBetween(meeting.date, end)) <= 3;
	});
	if (!market) return null;
	const odds = { hold: 0, hike: 0, cut: 0 };
	let read = 0;
	for (const o of market.outcomes) {
		const label = o.label.toLowerCase();
		const kind = /no change|hold|pause|unchanged|maintain/.test(label)
			? 'hold'
			: /increase|hike|raise/.test(label)
				? 'hike'
				: /decrease|cut|lower/.test(label)
					? 'cut'
					: null;
		if (!kind) continue;
		odds[kind] += o.p;
		read++;
	}
	return read ? { ...odds, url: market.url } : null;
}

const fmtNy = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit' });
const fmtMadrid = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit' });

/**
 * Hora de la decisión en España. El BCE decide a las 14:15 de Fráncfort (misma hora que Madrid); la Fed,
 * a las 14:00 de Washington, que son las 20:00 salvo las semanas en que EE. UU. y Europa cambian
 * de hora en días distintos (19:00 a finales de octubre).
 */
export function decisionTime(m: Meeting): string {
	if (m.bank === 'ecb') return '14:15';
	// 14:00 en Nueva York son las 18:00 UTC en horario de verano y las 19:00 en invierno.
	const utc = [18, 19].map((h) => new Date(`${m.date}T${h}:00:00Z`)).find((d) => fmtNy.format(d) === '14:00');
	return utc ? fmtMadrid.format(utc) : '20:00';
}
