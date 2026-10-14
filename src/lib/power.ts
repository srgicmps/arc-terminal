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
