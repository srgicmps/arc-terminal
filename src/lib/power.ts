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

/** La franja de horas seguidas más barata de un día, para poner la lavadora o el lavavajillas. */
export interface PriceWindow {
	/** Primera y última hora de la franja (la franja acaba al final de `last`). */
	first: HourPrice;
	last: HourPrice;
	/** Precio medio de la franja, en €/kWh. */
	avg: number;
	/** Precio medio de todo el día, en €/kWh. */
	dayAvg: number;
	/** Cuánto más barata es que la media del día, en % (positivo: ahorro). */
	saving: number;
}

/**
 * Las `n` horas seguidas más baratas de un día. `prices` son las horas de ese día en orden (las de
 * hourly() filtradas por día): se recorren por posición, no por número de hora, así que vale igual el día
 * de 23 o de 25 horas del cambio de hora. Si hay empate, gana la primera. Null si el día tiene menos de `n`.
 */
export function bestWindow(prices: HourPrice[], n: number): PriceWindow | null {
	if (n < 1 || prices.length < n) return null;
	const dayAvg = prices.reduce((a, p) => a + p.kwh, 0) / prices.length;
	let sum = prices.slice(0, n).reduce((a, p) => a + p.kwh, 0);
	let best = { at: 0, sum };
	for (let i = n; i < prices.length; i++) {
		sum += prices[i].kwh - prices[i - n].kwh;
		if (sum < best.sum - 1e-12) best = { at: i - n + 1, sum };
	}
	const avg = best.sum / n;
	return {
		first: prices[best.at],
		last: prices[best.at + n - 1],
		avg,
		dayAvg,
		saving: dayAvg ? ((dayAvg - avg) / dayAvg) * 100 : 0
	};
}
