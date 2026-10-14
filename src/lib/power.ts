// Precio de la luz (REE): agrupar por día y hora de Madrid.
import type { PricePoint } from './types.ts';

export interface HourPrice {
	/** «2026-10-14» */
	day: string;
	hour: number;
	/** €/kWh */
	kwh: number;
}

/** Agrupa por hora (el mercado mayorista va por cuartos de hora) y pasa de €/MWh a €/kWh. */
export function hourly(points: PricePoint[]): HourPrice[] {
	const groups = new Map<string, number[]>();
	for (const p of points) {
		const key = p.t.slice(0, 13); // «2026-10-14T05»: la hora ya viene en horario de Madrid
		groups.set(key, [...(groups.get(key) ?? []), p.v]);
	}
	return [...groups.entries()]
		.map(([key, values]) => ({
			day: key.slice(0, 10),
			hour: Number(key.slice(11, 13)),
			kwh: values.reduce((a, b) => a + b, 0) / values.length / 1000
		}))
		.sort((a, b) => a.day.localeCompare(b.day) || a.hour - b.hour);
}

/** Días presentes, en orden. */
export function days(prices: HourPrice[]): string[] {
	return [...new Set(prices.map((p) => p.day))].sort();
}

/** Resumen de un día: más barata, más cara, media y las tres horas más baratas (no tienen por qué ir seguidas). */
export function dayStats(prices: HourPrice[]) {
	const sorted = [...prices].sort((a, b) => a.kwh - b.kwh);
	const avg = prices.reduce((a, p) => a + p.kwh, 0) / (prices.length || 1);
	return { min: sorted[0], max: sorted.at(-1), avg, cheap: sorted.slice(0, 3) };
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
 * La franja de `hours` horas seguidas más barata que interesa ahora: la de hoy o, desde las 20:30 (cuando
 * REE ya ha publicado el PVPC del día siguiente), la de mañana. null si aún no hay precios de ese día.
 */
export function cheapestNow(
	prices: HourPrice[],
	now: number,
	hours = 2
): { day: string; start: number; end: number; avg: number; tomorrow: boolean } | null {
	const today = madridNow(now).day;
	const tomorrow = madridMinutes(now) >= 20 * 60 + 30;
	const day = tomorrow ? days(prices).find((d) => d > today) : today;
	const window = day ? cheapestWindow(prices, day, hours) : null;
	return day && window ? { day, ...window, tomorrow } : null;
}

/** Fecha y hora de Madrid de un instante: { day: «2026-10-14», hour: 13 }. */
export function madridNow(now: number): { day: string; hour: number } {
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

/**
 * Las `length` horas seguidas más baratas de un día, empezando como pronto en `fromHour`
 * (para «lo que queda de hoy»). Devuelve la hora de inicio, la de fin (sin incluir) y la media.
 */
export function cheapestWindow(
	prices: HourPrice[],
	day: string,
	length = 2,
	fromHour = 0
): { start: number; end: number; avg: number } | null {
	const byHour = new Map(prices.filter((p) => p.day === day).map((p) => [p.hour, p.kwh]));
	let best: { start: number; end: number; avg: number } | null = null;
	for (let start = fromHour; start + length <= 24; start++) {
		const values = Array.from({ length }, (_, i) => byHour.get(start + i));
		if (values.some((v) => v === undefined)) continue;
		const avg = (values as number[]).reduce((a, b) => a + b, 0) / length;
		if (!best || avg < best.avg) best = { start, end: start + length, avg };
	}
	return best;
}
