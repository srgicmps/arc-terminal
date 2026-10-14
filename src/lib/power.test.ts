import { describe, expect, it } from 'vitest';
import { bestWindow, cheapestNow, cheapestWindow, days, dayStats, hourLabel, hourly, isHour, madridNow } from './power.ts';

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

describe('franja más barata', () => {
	const day = (d: string, kwh: number[]) => kwh.map((v, hour) => ({ day: d, hour, repeat: false, kwh: v }));
	// 24 horas: caras por la noche, baratas de 14 a 16.
	const curve = Array.from({ length: 24 }, (_, h) => (h >= 14 && h < 16 ? 0.05 : h === 3 ? 0.06 : 0.15));
	// Horas de un día de cambio de hora, con el precio que se pida para cada posición.
	const dst = (fromUtc: string, n: number, kwh: (i: number) => number) =>
		hourly(
			Array.from({ length: n }, (_, i) => {
				const at = Date.parse(fromUtc) + i * 3_600_000;
				const off = new Intl.DateTimeFormat('en', { timeZone: 'Europe/Madrid', timeZoneName: 'longOffset' })
					.formatToParts(at)
					.find((p) => p.type === 'timeZoneName')!.value.replace('GMT', '');
				const local = new Date(at + (off === '+01:00' ? 3_600_000 : 7_200_000)).toISOString().slice(0, 19);
				return { t: `${local}.000${off}`, v: kwh(i) * 1000 };
			})
		);

	it('cheapestWindow: las horas seguidas más baratas, con la hora en la que acaba', () => {
		const w = cheapestWindow(day('2026-10-14', curve), '2026-10-14');
		expect([w?.first.hour, w?.after.hour, w?.avg]).toEqual([14, 16, 0.05]);
		expect(cheapestWindow(day('2026-10-14', curve), '2026-10-14', 2, 15)?.first.hour).toBe(15);
		expect(cheapestWindow([], '2026-10-14')).toBeNull();
	});

	it('25 oct 2026: las dos 02:00 son dos horas distintas de la franja', () => {
		// Posiciones 2 y 3 (02:00 y 02:00 ²) las más baratas.
		const prices = dst('2026-10-24T22:00:00Z', 25, (i) => (i === 2 || i === 3 ? 0.01 : 0.2));
		const w = cheapestWindow(prices, '2026-10-25');
		expect([hourLabel(w!.first), hourLabel(w!.after)]).toEqual(['02:00', '03:00']);
		expect(w?.avg).toBeCloseTo(0.01);
	});

	it('29 mar 2026: sin 02:00, la franja de 01:00 y 03:00 son dos horas seguidas', () => {
		const prices = dst('2026-03-28T23:00:00Z', 23, (i) => (i === 1 || i === 2 ? 0.01 : 0.2));
		const w = cheapestWindow(prices, '2026-03-29');
		expect([hourLabel(w!.first), hourLabel(w!.after)]).toEqual(['01:00', '04:00']);
	});

	it('dayStats da mínimo, máximo, media y las tres más baratas', () => {
		const s = dayStats(day('d', [0.3, 0.1, 0.2, 0.4]));
		expect([s.min?.hour, s.max?.hour, s.avg, s.cheap.map((p) => p.hour)]).toEqual([1, 3, 0.25, [1, 2, 0]]);
	});

	it('cheapestNow: la de hoy y, desde las 20:30 de Madrid, la de mañana si ya está', () => {
		const prices = [...day('2026-10-14', curve), ...day('2026-10-15', [...curve].reverse())];
		const at = (iso: string) => Date.parse(iso);
		expect(cheapestNow(prices, at('2026-10-14T18:29:00Z'))).toMatchObject({ day: '2026-10-14', first: { hour: 14 }, tomorrow: false });
		expect(cheapestNow(prices, at('2026-10-14T18:30:00Z'))).toMatchObject({ day: '2026-10-15', first: { hour: 8 }, tomorrow: true });
		expect(cheapestNow(day('2026-10-14', curve), at('2026-10-14T19:00:00Z'))).toBeNull();
	});
});

describe('bestWindow', () => {
	const day = (kwh: number[], d = '2026-10-14') => kwh.map((k, hour) => ({ day: d, hour, kwh: k, repeat: false }));

	it('las n horas seguidas más baratas y el ahorro frente a la media del día', () => {
		const prices = day([0.2, 0.1, 0.05, 0.06, 0.3, 0.29]);
		const w2 = bestWindow(prices, 2)!;
		expect([w2.first.hour, w2.last.hour]).toEqual([2, 3]);
		expect(w2.avg).toBeCloseTo(0.055, 6);
		expect(w2.dayAvg).toBeCloseTo(0.1666667, 6);
		expect(w2.saving).toBeCloseTo(67, 0);
		const w3 = bestWindow(prices, 3)!;
		expect([w3.first.hour, w3.last.hour]).toEqual([1, 3]);
	});

	it('empate: la primera; y nada si el día es más corto que la franja', () => {
		expect(bestWindow(day([0.1, 0.1, 0.1]), 2)?.first.hour).toBe(0);
		expect(bestWindow(day([0.1]), 2)).toBeNull();
		expect(bestWindow([], 1)).toBeNull();
	});

	it('día de 25 horas: cuenta por posición, con las dos 02:00', () => {
		const hours = [0, 1, 2, 2, 3, 4].map((hour, i) => ({ day: '2026-10-25', hour, kwh: [0.2, 0.2, 0.05, 0.04, 0.2, 0.2][i], repeat: i === 3 }));
		const w = bestWindow(hours, 2)!;
		expect(w.first).toBe(hours[2]);
		expect(w.last).toBe(hours[3]); // la segunda 02:00
	});
});
