// Precio de la luz (REE): agrupar por día y hora de Madrid.
import type { PricePoint } from './types.ts';

export interface HourPrice {
	/** «2026-10-14» */
	day: string;
	hour: number;
	/**
	 * Segunda pasada de una hora que se repite: el último domingo de octubre, al atrasar el reloj, hay dos
	 * 02:00 (la de +02:00 y la de +01:00). El día del cambio de marzo no hay 02:00 y salen 23 horas.
	 */
	repeat: boolean;
	/** €/kWh */
	kwh: number;
}

/**
 * Agrupa por hora (el mercado mayorista va por cuartos de hora) y pasa de €/MWh a €/kWh. La hora ya viene
 * en horario de Madrid; la zona (+01:00 o +02:00) separa las dos 02:00 del día del cambio de octubre.
 */
export function hourly(points: PricePoint[]): HourPrice[] {
	const groups = new Map<string, { t: number; values: number[] }>();
	for (const p of points) {
		const key = `${p.t.slice(0, 13)}${p.t.match(/([+-]\d\d:?\d\d|Z)$/)?.[1] ?? ''}`;
		const group = groups.get(key) ?? { t: Date.parse(p.t), values: [] };
		group.values.push(p.v);
		groups.set(key, group);
	}
	const out: HourPrice[] = [];
	for (const [key, { values }] of [...groups.entries()].sort((a, b) => a[1].t - b[1].t)) {
		const day = key.slice(0, 10);
		const hour = Number(key.slice(11, 13));
		const prev = out.at(-1);
		out.push({
			day,
			hour,
			repeat: prev?.day === day && prev.hour === hour,
			kwh: values.reduce((a, b) => a + b, 0) / values.length / 1000
		});
	}
	return out;
}

/** «14:00», o «02:00 ²» para la segunda 02:00 del día del cambio de hora de octubre. */
export function hourLabel(p: { hour: number; repeat?: boolean }): string {
	return `${String(p.hour).padStart(2, '0')}:00${p.repeat ? ' ²' : ''}`;
}

/** ¿Es `p` la hora `now` (día, hora y, el día del cambio de octubre, cuál de las dos 02:00)? */
export function isHour(p: HourPrice, now: { day: string; hour: number; repeat: boolean } | null): boolean {
	return !!now && p.day === now.day && p.hour === now.hour && p.repeat === now.repeat;
}

/** Días presentes, en orden. */
export function days(prices: HourPrice[]): string[] {
	return [...new Set(prices.map((p) => p.day))].sort();
}

/**
 * Fecha y hora de Madrid de un instante: { day: «2026-10-14», hour: 13, repeat: false }. `repeat` es true
 * en la segunda pasada de una hora que se repite (de 02:00 a 03:00 del día del cambio de octubre).
 */
export function madridNow(now: number): { day: string; hour: number; repeat: boolean } {
	const at = madridHour(now);
	const before = madridHour(now - 3_600_000);
	return { ...at, repeat: before.day === at.day && before.hour === at.hour };
}

function madridHour(now: number): { day: string; hour: number } {
	const parts = new Intl.DateTimeFormat('en-CA', {
		timeZone: 'Europe/Madrid',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		hourCycle: 'h23'
	}).formatToParts(new Date(now));
	const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
	return { day: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')) };
}

/** Resumen de un día: más barata, más cara, media y las tres horas más baratas (no tienen por qué ir seguidas). */
export function dayStats(prices: HourPrice[]) {
	const sorted = [...prices].sort((a, b) => a.kwh - b.kwh);
	const avg = prices.reduce((a, p) => a + p.kwh, 0) / (prices.length || 1);
	return { min: sorted[0], max: sorted.at(-1), avg, cheap: sorted.slice(0, 3) };
}

export interface CheapWindow {
	/** Primera hora de la franja. */
	first: HourPrice;
	/** Hora en la que acaba la franja (la siguiente a la última): «14:00–16:00» son first 14 y after 16. */
	after: { hour: number; repeat: boolean };
	/** Precio medio de la franja, €/kWh. */
	avg: number;
}

/**
 * Las `length` horas seguidas más baratas de un día, empezando como pronto en `fromHour`. Recorre las
 * horas del día por posición (en el orden real, que da `hourly`), así que el día del cambio de octubre
 * las dos 02:00 cuentan como dos horas y el de marzo, sin 02:00, dos horas desde la 01:00 acaban a las 04:00.
 */
export function cheapestWindow(prices: HourPrice[], day: string, length = 2, fromHour = 0): CheapWindow | null {
	const hours = prices.filter((p) => p.day === day);
	let best: CheapWindow | null = null;
	for (let i = 0; i + length <= hours.length; i++) {
		if (hours[i].hour < fromHour) continue;
		const run = hours.slice(i, i + length);
		const avg = run.reduce((a, p) => a + p.kwh, 0) / length;
		if (!best || avg < best.avg) {
			const next = hours[i + length];
			best = {
				first: run[0],
				after: next ? { hour: next.hour, repeat: next.repeat } : { hour: (run.at(-1)!.hour + 1) % 24, repeat: false },
				avg
			};
		}
	}
	return best;
}

/** Minutos desde la medianoche en Madrid. */
function madridMinutes(now: number): number {
	const parts = new Intl.DateTimeFormat('en-GB', {
		timeZone: 'Europe/Madrid',
		hour: '2-digit',
		minute: '2-digit',
		hourCycle: 'h23'
	}).formatToParts(new Date(now));
	const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
	return get('hour') * 60 + get('minute');
}

/**
 * La franja de `hours` horas seguidas más barata que interesa ahora: la de lo que queda de hoy (empieza en la hora
 * en curso o después; una ya pasada no sirve) o, desde las 20:30 (cuando REE ya ha publicado el PVPC del día
 * siguiente), la de mañana. null si aún no hay precios de ese día o ya no cabe ninguna hoy.
 */
export function cheapestNow(
	prices: HourPrice[],
	now: number,
	hours = 2
): (CheapWindow & { day: string; tomorrow: boolean }) | null {
	const today = madridNow(now).day;
	const tomorrow = madridMinutes(now) >= 20 * 60 + 30;
	const day = tomorrow ? days(prices).find((d) => d > today) : today;
	const window = day ? cheapestWindow(prices, day, hours, tomorrow ? 0 : madridNow(now).hour) : null;
	return day && window ? { ...window, day, tomorrow } : null;
}

/**
 * Las `count` mejores franjas de `length` horas seguidas de un día, sin tocarse (entre dos hay al menos una hora), de la más barata a la más cara
 * (horas baratas para la lavadora o el coche). Con `from` (la hora actual de Madrid) solo cuentan las que empiezan
 * en la hora en curso o después. Sirve también para los avisos de casa (F16): `cheapWindows(hourly(pvpc), mañana, 2)`.
 */
export function cheapWindows(
	prices: HourPrice[],
	day: string,
	length = 2,
	count = 3,
	from?: { day: string; hour: number; repeat: boolean } | null
): CheapWindow[] {
	const hours = prices.filter((p) => p.day === day);
	// Primera posición válida: la hora actual en adelante si es hoy (la segunda 02:00 cuenta como posterior).
	let start = 0;
	if (from && from.day === day) {
		start = hours.findIndex((p) => p.hour > from.hour || (p.hour === from.hour && (p.repeat || !from.repeat)));
		if (start < 0) return [];
	} else if (from && from.day > day) return [];
	const all: { i: number; w: CheapWindow }[] = [];
	for (let i = start; i + length <= hours.length; i++) {
		const run = hours.slice(i, i + length);
		const next = hours[i + length];
		all.push({
			i,
			w: {
				first: run[0],
				after: next ? { hour: next.hour, repeat: next.repeat } : { hour: (run.at(-1)!.hour + 1) % 24, repeat: false },
				avg: run.reduce((a, p) => a + p.kwh, 0) / length
			}
		});
	}
	const picked: typeof all = [];
	for (const c of all.sort((a, b) => a.w.avg - b.w.avg || a.i - b.i)) {
		if (picked.length >= count) break;
		if (picked.every((p) => c.i + length < p.i || p.i + length < c.i)) picked.push(c);
	}
	return picked.map((p) => p.w);
}
