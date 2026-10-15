// Calendario de decisiones de tipos de los grandes bancos centrales, en hora de Madrid.
//
// Fechas del día de la decisión, copiadas una a una de los calendarios oficiales (comprobadas en octubre
// de 2026 con scripts/probe.txt). El BCE y la Fed salen de meetings.ts. Revisar cada año, cuando publiquen
// el siguiente: el test avisa si falta el año que viene.
// Horas: la del BNS y la del LPR (9:00 de Pekín) salen de sus webs; las del BoE (12:00 de Londres), BoC (9:45
// de Ottawa) y RBA (14:30 de Sídney) son su hora habitual de anuncio, que no figura en la página del calendario.
// Descartados por no tener un calendario legible desde Actions: Banxico (404), Banco Central do Brasil
// (la página se pinta con JavaScript y su API da error) y Reserve Bank of India (sin calendario en la web).
import { MEETINGS } from './meetings.ts';

export type CbBank = 'ecb' | 'fed' | 'boe' | 'boj' | 'snb' | 'boc' | 'rba' | 'pboc';

export interface CbInfo {
	name: string;
	long: string;
	url: string;
	/** Zona horaria del banco y hora local del anuncio («HH:MM»); null si no tiene hora fija. */
	tz: string;
	time: string | null;
}

export const CB: Record<CbBank, CbInfo> = {
	ecb: {
		name: 'BCE',
		long: 'Banco Central Europeo',
		url: 'https://www.ecb.europa.eu/press/calendars/mgcgc/html/index.en.html',
		tz: 'Europe/Berlin',
		time: '14:15'
	},
	fed: {
		name: 'Fed',
		long: 'Reserva Federal',
		url: 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm',
		tz: 'America/New_York',
		time: '14:00'
	},
	boe: {
		name: 'BoE',
		long: 'Banco de Inglaterra',
		url: 'https://www.bankofengland.co.uk/monetary-policy/upcoming-mpc-dates',
		tz: 'Europe/London',
		time: '12:00'
	},
	// El BoJ anuncia al acabar la reunión, sin hora fija (suele ser hacia mediodía en Tokio).
	boj: {
		name: 'BoJ',
		long: 'Banco de Japón',
		url: 'https://www.boj.or.jp/en/mopo/mpmsche_minu/index.htm',
		tz: 'Asia/Tokyo',
		time: null
	},
	snb: {
		name: 'BNS',
		long: 'Banco Nacional Suizo',
		url: 'https://www.snb.ch/en/services-events/digital-services/event-schedule',
		tz: 'Europe/Zurich',
		time: '09:30'
	},
	boc: {
		name: 'BoC',
		long: 'Banco de Canadá',
		url: 'https://www.bankofcanada.ca/core-functions/monetary-policy/key-interest-rate/',
		tz: 'America/Toronto',
		time: '09:45'
	},
	rba: {
		name: 'RBA',
		long: 'Banco de la Reserva de Australia',
		url: 'https://www.rba.gov.au/schedules-events/board-meeting-schedules.html',
		tz: 'Australia/Sydney',
		time: '14:30'
	},
	pboc: {
		name: 'PBoC',
		long: 'Banco Popular de China (LPR)',
		url: 'https://www.chinamoney.com.cn/english/bmklpr/',
		tz: 'Asia/Shanghai',
		time: '09:00'
	}
};

/** Día de la decisión (el último de la reunión, si dura dos) y si publica informe con previsiones. */
type Row = [date: string, report?: boolean];

const DATES: Record<Exclude<CbBank, 'ecb' | 'fed' | 'pboc'>, Row[]> = {
	// Con informe: Monetary Policy Report.
	boe: [
		['2026-02-05', true], ['2026-03-19'], ['2026-04-30', true], ['2026-06-18'],
		['2026-07-30', true], ['2026-09-17'], ['2026-11-05', true], ['2026-12-17'],
		['2027-02-04', true], ['2027-03-18'], ['2027-04-29', true], ['2027-06-17'],
		['2027-07-29', true], ['2027-09-16'], ['2027-11-04', true], ['2027-12-16']
	],
	// Con informe: Outlook Report.
	boj: [
		['2026-01-23', true], ['2026-03-19'], ['2026-04-28', true], ['2026-06-16'],
		['2026-07-31', true], ['2026-09-18'], ['2026-10-30', true], ['2026-12-18'],
		['2027-01-22', true], ['2027-03-18'], ['2027-04-28', true], ['2027-06-11'],
		['2027-07-22', true], ['2027-09-22'], ['2027-10-29', true], ['2027-12-17']
	],
	// Evaluación trimestral (todas con previsión de inflación).
	snb: [
		['2026-03-19'], ['2026-06-18'], ['2026-09-24'], ['2026-12-10'],
		['2027-03-18'], ['2027-06-24'], ['2027-09-23'], ['2027-12-16']
	],
	// Con informe: Monetary Policy Report.
	boc: [
		['2026-01-28', true], ['2026-03-18'], ['2026-04-29', true], ['2026-06-10'],
		['2026-07-15', true], ['2026-09-02'], ['2026-10-28', true], ['2026-12-09'],
		['2027-01-27', true], ['2027-03-03'], ['2027-04-28', true], ['2027-06-02'],
		['2027-07-21', true], ['2027-09-08'], ['2027-10-27', true], ['2027-12-08']
	],
	// Reunión de dos días; decide el segundo.
	rba: [
		['2026-02-03'], ['2026-03-17'], ['2026-05-05'], ['2026-06-16'],
		['2026-08-11'], ['2026-09-29'], ['2026-11-03'], ['2026-12-08'],
		['2027-02-09'], ['2027-03-23'], ['2027-05-04'], ['2027-06-22'],
		['2027-08-10'], ['2027-09-28'], ['2027-11-02'], ['2027-12-14']
	]
};

/**
 * LPR del PBoC: se publica el día 20 de cada mes; si cae en fin de semana, el lunes siguiente.
 * Los festivos chinos (Año Nuevo lunar) también lo retrasan y no están contemplados (chinamoney.com.cn).
 */
export function lprDates(year: number): string[] {
	return Array.from({ length: 12 }, (_, m) => {
		const d = new Date(Date.UTC(year, m, 20));
		const wd = d.getUTCDay();
		if (wd === 6) d.setUTCDate(22);
		if (wd === 0) d.setUTCDate(21);
		return d.toISOString().slice(0, 10);
	});
}

/** Instante UTC de las `time` («HH:MM») del día `date` en la zona `tz`. */
export function zonedInstant(date: string, time: string, tz: string): Date {
	const guess = new Date(`${date}T${time}:00Z`);
	const parts = new Intl.DateTimeFormat('en-GB', {
		timeZone: tz,
		hourCycle: 'h23',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit'
	}).formatToParts(guess);
	const p = (t: string) => Number(parts.find((x) => x.type === t)?.value);
	const local = Date.UTC(p('year'), p('month') - 1, p('day'), p('hour'), p('minute'));
	return new Date(guess.getTime() - (local - guess.getTime()));
}

export interface CbMeeting {
	bank: CbBank;
	/** Día de la decisión en la zona del banco: «2026-10-29». */
	date: string;
	/** Instante del anuncio (ISO, UTC); null si no tiene hora fija. */
	at: string | null;
	/** Publica informe con previsiones (Fed: proyecciones económicas). */
	report?: boolean;
}

function meeting(bank: CbBank, date: string, report?: boolean): CbMeeting {
	const { time, tz } = CB[bank];
	return { bank, date, at: time ? zonedInstant(date, time, tz).toISOString() : null, report };
}

/** Todas las decisiones conocidas, por fecha. */
export const CB_MEETINGS: CbMeeting[] = [
	...MEETINGS.map((m) => meeting(m.bank, m.date, m.sep)),
	...Object.entries(DATES).flatMap(([bank, rows]) => rows.map(([d, r]) => meeting(bank as CbBank, d, r))),
	...[2026, 2027].flatMap(lprDates).map((d) => meeting('pboc', d))
].sort((a, b) => (a.at ?? `${a.date}T12:00`).localeCompare(b.at ?? `${b.date}T12:00`));

/** Decisiones desde `today` («AAAA-MM-DD», hora de Madrid), incluidas las de hoy. */
export function cbUpcoming(today: string, banks?: CbBank[]): CbMeeting[] {
	return CB_MEETINGS.filter((m) => m.date >= today && (!banks || banks.includes(m.bank)));
}
