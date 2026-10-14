// Días sin bolsa de Nueva York (NYSE) y de Madrid (BME), calculados con sus reglas. Así no hay una lista
// que caduque cada año.
// - NYSE: reglas de festivos de la Regla 7.2 de la NYSE (https://www.nyse.com/markets/hours-calendars).
// - LSE: festivos oficiales de Inglaterra (bank holidays, https://www.gov.uk/bank-holidays); si caen en fin
//   de semana, se pasan al siguiente día laborable. Solo para el reloj de la barra.
// - BME: la bolsa española cierra los días sin TARGET2 del Eurosistema (BCE): 1 de enero, Viernes Santo,
//   Lunes de Pascua, 1 de mayo, 25 y 26 de diciembre (https://www.bolsasymercados.es).

export interface MarketHoliday {
	/** «2026-12-25» */
	date: string;
	market: 'NYSE' | 'BME' | 'LSE' | 'XETRA' | 'B3';
	name: string;
}

const iso = (y: number, m: number, d: number) =>
	`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/** Día de la semana (0 domingo … 6 sábado). */
const dow = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d)).getUTCDay();

/** Domingo de Pascua (calendario gregoriano, algoritmo de Meeus/Jones/Butcher). */
export function easter(y: number): { m: number; d: number } {
	const a = y % 19;
	const b = Math.floor(y / 100);
	const c = y % 100;
	const d = Math.floor(b / 4);
	const e = b % 4;
	const f = Math.floor((b + 8) / 25);
	const g = Math.floor((b - f + 1) / 3);
	const h = (19 * a + b - d - g + 15) % 30;
	const i = Math.floor(c / 4);
	const k = c % 4;
	const l = (32 + 2 * e + 2 * i - h - k) % 7;
	const m = Math.floor((a + 11 * h + 22 * l) / 451);
	const month = Math.floor((h + l - 7 * m + 114) / 31);
	const day = ((h + l - 7 * m + 114) % 31) + 1;
	return { m: month, d: day };
}

/** Fecha desplazada `days` días. */
function shift(y: number, m: number, d: number, days: number): string {
	return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** El enésimo día de la semana `wd` del mes (n = -1: el último). */
function nth(y: number, m: number, wd: number, n: number): string {
	if (n > 0) {
		const first = dow(y, m, 1);
		return iso(y, m, 1 + ((wd - first + 7) % 7) + (n - 1) * 7);
	}
	const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
	return iso(y, m, lastDay - ((dow(y, m, lastDay) - wd + 7) % 7));
}

/** Festivo fijo de la NYSE: si cae en sábado se cierra el viernes; si cae en domingo, el lunes. */
function observed(y: number, m: number, d: number): string {
	const wd = dow(y, m, d);
	return wd === 6 ? shift(y, m, d, -1) : wd === 0 ? shift(y, m, d, 1) : iso(y, m, d);
}

export function nyseHolidays(y: number): MarketHoliday[] {
	const e = easter(y);
	const list: [string, string][] = [
		[nth(y, 1, 1, 3), 'Martin Luther King'],
		[nth(y, 2, 1, 3), 'Día de los Presidentes'],
		[shift(y, e.m, e.d, -2), 'Viernes Santo'],
		[nth(y, 5, 1, -1), 'Memorial Day'],
		[observed(y, 6, 19), 'Juneteenth'],
		[observed(y, 7, 4), 'Día de la Independencia'],
		[nth(y, 9, 1, 1), 'Día del Trabajo'],
		[nth(y, 11, 4, 4), 'Acción de Gracias'],
		[observed(y, 12, 25), 'Navidad']
	];
	// Año Nuevo en sábado no se recupera el viernes anterior (sería otro año): Regla 7.2.
	const ny = dow(y, 1, 1);
	if (ny !== 6) list.unshift([ny === 0 ? iso(y, 1, 2) : iso(y, 1, 1), 'Año Nuevo']);
	return list.map(([date, name]) => ({ date, market: 'NYSE', name }));
}

export function bmeHolidays(y: number): MarketHoliday[] {
	const e = easter(y);
	const list: [string, string][] = [
		[iso(y, 1, 1), 'Año Nuevo'],
		[shift(y, e.m, e.d, -2), 'Viernes Santo'],
		[shift(y, e.m, e.d, 1), 'Lunes de Pascua'],
		[iso(y, 5, 1), 'Día del Trabajo'],
		[iso(y, 12, 25), 'Navidad'],
		[iso(y, 12, 26), 'San Esteban']
	];
	// En fin de semana la bolsa ya está cerrada: no cuenta como día sin bolsa.
	return list
		.filter(([date]) => {
			const wd = new Date(`${date}T12:00:00Z`).getUTCDay();
			return wd !== 0 && wd !== 6;
		})
		.map(([date, name]) => ({ date, market: 'BME', name }));
}

export function lseHolidays(y: number): MarketHoliday[] {
	const e = easter(y);
	const weekend = (date: string) => [0, 6].includes(new Date(`${date}T12:00:00Z`).getUTCDay());
	const taken: string[] = [];
	// Año Nuevo, Navidad y San Esteban en fin de semana pasan al siguiente laborable libre.
	const substitute = (m: number, d: number) => {
		let date = iso(y, m, d);
		for (let k = 1; weekend(date) || taken.includes(date); k++) date = shift(y, m, d, k);
		taken.push(date);
		return date;
	};
	const list: [string, string][] = [
		[substitute(1, 1), 'Año Nuevo'],
		[shift(y, e.m, e.d, -2), 'Viernes Santo'],
		[shift(y, e.m, e.d, 1), 'Lunes de Pascua'],
		[nth(y, 5, 1, 1), 'Early May bank holiday'],
		[nth(y, 5, 1, -1), 'Spring bank holiday'],
		[nth(y, 8, 1, -1), 'Summer bank holiday'],
		[substitute(12, 25), 'Navidad'],
		[substitute(12, 26), 'San Esteban']
	];
	return list.map(([date, name]) => ({ date, market: 'LSE', name }));
}

/** Quita los que caen en fin de semana: ese día la bolsa ya está cerrada. */
function weekdays(list: [string, string][], market: MarketHoliday['market']): MarketHoliday[] {
	return list
		.filter(([date]) => ![0, 6].includes(new Date(`${date}T12:00:00Z`).getUTCDay()))
		.map(([date, name]) => ({ date, market, name }));
}

/**
 * Xetra (Fráncfort), según su calendario de negociación: Año Nuevo, Viernes Santo, Lunes de Pascua,
 * 1 de mayo, Nochebuena, Navidad, San Esteban y Nochevieja.
 */
export function xetraHolidays(y: number): MarketHoliday[] {
	const e = easter(y);
	return weekdays(
		[
			[iso(y, 1, 1), 'Año Nuevo'],
			[shift(y, e.m, e.d, -2), 'Viernes Santo'],
			[shift(y, e.m, e.d, 1), 'Lunes de Pascua'],
			[iso(y, 5, 1), 'Día del Trabajo'],
			[iso(y, 12, 24), 'Nochebuena'],
			[iso(y, 12, 25), 'Navidad'],
			[iso(y, 12, 26), 'San Esteban'],
			[iso(y, 12, 31), 'Nochevieja']
		],
		'XETRA'
	);
}

/**
 * B3 (São Paulo): festivos nacionales de Brasil en los que no abre la bolsa, Carnaval y Corpus Christi
 * (dependen de la Pascua), Nochebuena y Nochevieja.
 */
export function b3Holidays(y: number): MarketHoliday[] {
	const e = easter(y);
	return weekdays(
		[
			[iso(y, 1, 1), 'Año Nuevo'],
			[shift(y, e.m, e.d, -48), 'Carnaval'],
			[shift(y, e.m, e.d, -47), 'Carnaval'],
			[shift(y, e.m, e.d, -2), 'Viernes Santo'],
			[iso(y, 4, 21), 'Tiradentes'],
			[iso(y, 5, 1), 'Día del Trabajo'],
			[shift(y, e.m, e.d, 60), 'Corpus Christi'],
			[iso(y, 9, 7), 'Independencia'],
			[iso(y, 10, 12), 'Nuestra Señora Aparecida'],
			[iso(y, 11, 2), 'Difuntos'],
			[iso(y, 11, 15), 'Proclamación de la República'],
			[iso(y, 11, 20), 'Conciencia Negra'],
			[iso(y, 12, 24), 'Nochebuena'],
			[iso(y, 12, 25), 'Navidad'],
			[iso(y, 12, 31), 'Nochevieja']
		],
		'B3'
	);
}

/** Una bolsa: zona horaria, horario normal en minutos locales y sus festivos. */
export interface ClockMarket {
	code: string;
	/** Nombre corto en español, para la barra de sesiones: «Nueva York». */
	name: string;
	/** Nombre para la cuenta atrás: «NY abre en 2 h 10 min». */
	short: string;
	tz: string;
	open: [number, number];
	lunch?: [number, number];
	/** Días sin bolsa del año; sin esta función solo se tienen en cuenta los fines de semana. */
	holidays?: (y: number) => MarketHoliday[];
}

/**
 * Las bolsas principales, de este a oeste. Horario de la sesión continua de cada una (sin subastas):
 * TSE, HKEX, SSE, NSE, Xetra, LSE, BME, NYSE y B3. Los festivos están para Xetra, LSE, BME, NYSE y B3; en las
 * bolsas de Asia, de momento, solo los fines de semana.
 */
export const MARKETS: ClockMarket[] = [
	{ code: 'TYO', name: 'Tokio', short: 'Tokio', tz: 'Asia/Tokyo', open: [540, 930], lunch: [690, 750] },
	{ code: 'HKG', name: 'Hong Kong', short: 'Hong Kong', tz: 'Asia/Hong_Kong', open: [570, 960], lunch: [720, 780] },
	{ code: 'SHA', name: 'Shanghái', short: 'Shanghái', tz: 'Asia/Shanghai', open: [570, 900], lunch: [690, 780] },
	{ code: 'BOM', name: 'Bombay', short: 'Bombay', tz: 'Asia/Kolkata', open: [555, 930] },
	{ code: 'FRA', name: 'Fráncfort', short: 'Fráncfort', tz: 'Europe/Berlin', open: [540, 1050], holidays: xetraHolidays },
	{ code: 'LON', name: 'Londres', short: 'Londres', tz: 'Europe/London', open: [480, 990], holidays: lseHolidays },
	{ code: 'MAD', name: 'Madrid', short: 'Madrid', tz: 'Europe/Madrid', open: [540, 1050], holidays: bmeHolidays },
	{ code: 'NYC', name: 'Nueva York', short: 'NY', tz: 'America/New_York', open: [570, 960], holidays: nyseHolidays },
	// B3 mueve su horario una hora cuando EE. UU. cambia la hora; aquí, el de 10:00 a 17:00.
	{ code: 'SAO', name: 'São Paulo', short: 'São Paulo', tz: 'America/Sao_Paulo', open: [600, 1020], holidays: b3Holidays }
];

const market = (code: string) => MARKETS.find((m) => m.code === code)!;

/** Bolsas del reloj de la barra, en este orden. */
export const CLOCK_MARKETS: ClockMarket[] = ['NYC', 'LON', 'MAD', 'TYO'].map(market);

// ---------- Sesiones: cuándo abre y cierra cada bolsa ----------

/** Fecha local («2026-10-14») de un instante en una zona horaria. */
export function localDate(tz: string, ms: number): string {
	return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
}

/** Diferencia de la zona con UTC en un instante, en minutos (Madrid en verano: 120). */
function offset(tz: string, ms: number): number {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone: tz,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hourCycle: 'h23'
	}).formatToParts(new Date(ms));
	const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
	const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
	return Math.round((asUtc - Math.floor(ms / 1000) * 1000) / 60_000);
}

/** Instante (ms) en que son los `mins` minutos del día `date` en la zona `tz`. */
export function zoned(date: string, mins: number, tz: string): number {
	const [y, m, d] = date.split('-').map(Number);
	const guess = Date.UTC(y, m - 1, d, 0, mins);
	// Dos pasadas: la segunda corrige el día del cambio de hora.
	const first = guess - offset(tz, guess) * 60_000;
	return guess - offset(tz, first) * 60_000;
}

/** Fecha `days` días después: «2026-10-14» + 1 → «2026-10-15». */
export function addDays(date: string, days: number): string {
	const [y, m, d] = date.split('-').map(Number);
	return shift(y, m, d, days);
}

/** Festivo de la bolsa ese día local, si lo hay. */
export function holidayOn(mk: ClockMarket, date: string): string | null {
	return mk.holidays?.(Number(date.slice(0, 4))).find((h) => h.date === date)?.name ?? null;
}

/** Tramos abiertos de una bolsa el día local `date`, en instantes [inicio, fin): vacío si no hay sesión. */
export function sessionsOn(mk: ClockMarket, date: string): [number, number][] {
	const [y, m, d] = date.split('-').map(Number);
	const wd = dow(y, m, d);
	if (wd === 0 || wd === 6 || holidayOn(mk, date)) return [];
	const spans: [number, number][] = mk.lunch
		? [
				[mk.open[0], mk.lunch[0]],
				[mk.lunch[1], mk.open[1]]
			]
		: [mk.open];
	return spans.map(([a, b]) => [zoned(date, a, mk.tz), zoned(date, b, mk.tz)]);
}

export interface MarketStatus {
	isOpen: boolean;
	/** Cuándo cambia de estado: el cierre si está abierta (o la pausa de mediodía), la apertura si no. */
	next: number | null;
	/** Festivo de hoy (día local de la bolsa), si lo hay. */
	holiday: string | null;
}

/** Si una bolsa está abierta ahora y cuándo cierra o vuelve a abrir (busca hasta dos semanas). */
export function marketStatus(mk: ClockMarket, now: number): MarketStatus {
	const today = localDate(mk.tz, now);
	const holiday = holidayOn(mk, today);
	for (let k = 0; k < 15; k++) {
		for (const [a, b] of sessionsOn(mk, addDays(today, k))) {
			if (now >= a && now < b) return { isOpen: true, next: b, holiday };
			if (a > now) return { isOpen: false, next: a, holiday };
		}
	}
	return { isOpen: false, next: null, holiday };
}

/**
 * Tramos abiertos de una bolsa dentro del día de Madrid que contiene `now`, como fracciones del día
 * (0 = medianoche, 1 = la siguiente). Para la barra de 24 h. También da dónde cae `now`.
 */
export function madridDay(mk: ClockMarket, now: number): { spans: [number, number][]; now: number } {
	const date = localDate('Europe/Madrid', now);
	const start = zoned(date, 0, 'Europe/Madrid');
	const end = zoned(addDays(date, 1), 0, 'Europe/Madrid');
	const len = end - start;
	const spans = [-1, 0, 1]
		.flatMap((k) => sessionsOn(mk, addDays(date, k)))
		.filter(([a, b]) => b > start && a < end)
		.map(([a, b]): [number, number] => [(Math.max(a, start) - start) / len, (Math.min(b, end) - start) / len]);
	return { spans, now: (now - start) / len };
}

/** Tiempo hasta un instante: «2 h 10 min», «45 min», «2 d 3 h». */
export function until(ms: number): string {
	const mins = Math.max(0, Math.ceil(ms / 60_000));
	const d = Math.floor(mins / 1440);
	const h = Math.floor((mins % 1440) / 60);
	const m = mins % 60;
	if (d) return h ? `${d} d ${h} h` : `${d} d`;
	if (h) return m ? `${h} h ${m} min` : `${h} h`;
	return `${m} min`;
}

export interface ClockState {
	/** «09:41», hora local de la bolsa. */
	time: string;
	isOpen: boolean;
	/** Nombre del festivo si hoy (hora local de la bolsa) no hay sesión. */
	holiday: string | null;
}

/** Hora local de una bolsa y si está abierta ahora: horario normal, fines de semana y festivos. */
export function clockState(market: ClockMarket, now: number): ClockState {
	const parts = new Intl.DateTimeFormat('en-CA', {
		timeZone: market.tz,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		weekday: 'short',
		hourCycle: 'h23'
	}).formatToParts(new Date(now));
	const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
	const [h, m] = [Number(get('hour')), Number(get('minute'))];
	const date = `${get('year')}-${get('month')}-${get('day')}`;
	const holiday = market.holidays?.(Number(get('year'))).find((x) => x.date === date)?.name ?? null;
	const mins = h * 60 + m;
	const weekend = get('weekday') === 'Sat' || get('weekday') === 'Sun';
	let isOpen = !weekend && !holiday && mins >= market.open[0] && mins < market.open[1];
	if (isOpen && market.lunch && mins >= market.lunch[0] && mins < market.lunch[1]) isOpen = false;
	return { time: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`, isOpen, holiday };
}
