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
		.sort((a, b) => (a.day + a.hour).localeCompare(b.day + b.hour));
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
