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
	market: 'NYSE' | 'BME' | 'LSE';
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

/** Bolsas del reloj de la barra: zona horaria, horario normal en minutos locales y sus festivos. */
export interface ClockMarket {
	code: string;
	tz: string;
	open: [number, number];
	lunch?: [number, number];
	/** Días sin bolsa del año; sin esta función solo se tienen en cuenta los fines de semana. */
	holidays?: (y: number) => MarketHoliday[];
}

export const CLOCK_MARKETS: ClockMarket[] = [
	{ code: 'NYC', tz: 'America/New_York', open: [570, 960], holidays: nyseHolidays },
	{ code: 'LON', tz: 'Europe/London', open: [480, 990], holidays: lseHolidays },
	{ code: 'MAD', tz: 'Europe/Madrid', open: [540, 1050], holidays: bmeHolidays },
	{ code: 'TYO', tz: 'Asia/Tokyo', open: [540, 930], lunch: [690, 750] }
];

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
