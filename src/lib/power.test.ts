import { describe, expect, it } from 'vitest';
import { days, hourLabel, hourly, isHour, madridNow } from './power.ts';

const t = (day: string, h: number, m = 0) => `${day}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00.000+02:00`;

describe('hourly', () => {
	it('agrupa los cuartos de hora y pasa de €/MWh a €/kWh', () => {
		const points = [0, 15, 30, 45].map((m, i) => ({ t: t('2026-10-14', 5, m), v: 100 + i * 10 }));
		expect(hourly(points)).toEqual([{ day: '2026-10-14', hour: 5, repeat: false, kwh: 0.115 }]);
	});

	it('ordena por día y hora (la hora 2 va antes que la 10)', () => {
		const points = [
			...Array.from({ length: 24 }, (_, h) => ({ t: t('2026-10-15', h), v: h })),
			...Array.from({ length: 24 }, (_, h) => ({ t: t('2026-10-14', h), v: h }))
		];
		const result = hourly(points);
		expect(result.map((p) => `${p.day} ${p.hour}`)).toEqual([
			...Array.from({ length: 24 }, (_, h) => `2026-10-14 ${h}`),
			...Array.from({ length: 24 }, (_, h) => `2026-10-15 ${h}`)
		]);
	});
});

describe('cambio de hora', () => {
	// Cuartos de hora en hora de Madrid de un día entero, a partir de su medianoche en UTC.
	const quarters = (fromUtc: string, hours: number) =>
		Array.from({ length: hours * 4 }, (_, i) => {
			const at = Date.parse(fromUtc) + i * 900_000;
			const off = new Intl.DateTimeFormat('en', { timeZone: 'Europe/Madrid', timeZoneName: 'longOffset' })
				.formatToParts(at)
				.find((p) => p.type === 'timeZoneName')!.value.replace('GMT', '');
			const local = new Date(at + (off === '+01:00' ? 3_600_000 : 7_200_000)).toISOString().slice(0, 19);
			return { t: `${local}.000${off}`, v: 100 + Math.floor(i / 4) };
		});

	it('25 oct 2026: salen 25 horas, con dos 02:00 que no se mezclan', () => {
		const result = hourly(quarters('2026-10-24T22:00:00Z', 25));
		expect(result).toHaveLength(25);
		expect(result.map(hourLabel).slice(1, 5)).toEqual(['01:00', '02:00', '02:00 ²', '03:00']);
		// Cada hora conserva su precio: la primera 02:00 es la tercera hora del día y la segunda, la cuarta.
		expect(result.slice(2, 4).map((p) => p.kwh)).toEqual([0.102, 0.103]);
		expect(result.every((p) => p.day === '2026-10-25')).toBe(true);
	});

	it('29 mar 2026: salen 23 horas, sin 02:00', () => {
		const result = hourly(quarters('2026-03-28T23:00:00Z', 23));
		expect(result).toHaveLength(23);
		expect(result.map((p) => p.hour).slice(0, 4)).toEqual([0, 1, 3, 4]);
		expect(result.some((p) => p.repeat)).toBe(false);
	});

	it('madridNow distingue la primera y la segunda 02:00 del 25 de octubre', () => {
		const first = madridNow(Date.parse('2026-10-25T00:30:00Z'));
		const second = madridNow(Date.parse('2026-10-25T01:30:00Z'));
		expect(first).toEqual({ day: '2026-10-25', hour: 2, repeat: false });
		expect(second).toEqual({ day: '2026-10-25', hour: 2, repeat: true });
		const prices = hourly(quarters('2026-10-24T22:00:00Z', 25));
		expect(prices.findIndex((p) => isHour(p, first))).toBe(2);
		expect(prices.findIndex((p) => isHour(p, second))).toBe(3);
		expect(madridNow(Date.parse('2026-10-25T02:30:00Z'))).toEqual({ day: '2026-10-25', hour: 3, repeat: false });
	});
});

describe('days', () => {
	it('devuelve los días distintos, en orden', () => {
		expect(
			days([
				{ day: '2026-10-15', hour: 0, repeat: false, kwh: 1 },
				{ day: '2026-10-14', hour: 1, repeat: false, kwh: 1 },
				{ day: '2026-10-14', hour: 0, repeat: false, kwh: 1 }
			])
		).toEqual(['2026-10-14', '2026-10-15']);
	});
});

describe('madridNow', () => {
	it('da el día y la hora de Madrid, en verano y en invierno', () => {
		expect(madridNow(Date.parse('2026-10-14T22:30:00Z'))).toEqual({ day: '2026-10-15', hour: 0, repeat: false });
		expect(madridNow(Date.parse('2026-12-31T23:10:00Z'))).toEqual({ day: '2027-01-01', hour: 0, repeat: false });
		expect(madridNow(Date.parse('2026-10-14T10:59:00Z'))).toEqual({ day: '2026-10-14', hour: 12, repeat: false });
	});
});
