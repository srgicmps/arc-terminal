// Días sin bolsa de Nueva York (NYSE) y de Madrid (BME), calculados con sus reglas. Así no hay una lista
// que caduque cada año.
// - NYSE: reglas de festivos de la Regla 7.2 de la NYSE (https://www.nyse.com/markets/hours-calendars).
// - BME: la bolsa española cierra los días sin TARGET2 del Eurosistema (BCE): 1 de enero, Viernes Santo,
//   Lunes de Pascua, 1 de mayo, 25 y 26 de diciembre (https://www.bolsasymercados.es).

export interface MarketHoliday {
	/** «2026-12-25» */
	date: string;
	market: 'NYSE' | 'BME';
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
