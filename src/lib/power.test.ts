import { describe, expect, it } from 'vitest';
import { bestWindow, days, hourly, madridNow } from './power.ts';

const t = (day: string, h: number, m = 0) => `${day}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00.000+02:00`;

describe('hourly', () => {
	it('agrupa los cuartos de hora y pasa de €/MWh a €/kWh', () => {
		const points = [0, 15, 30, 45].map((m, i) => ({ t: t('2026-10-14', 5, m), v: 100 + i * 10 }));
		expect(hourly(points)).toEqual([{ day: '2026-10-14', hour: 5, kwh: 0.115 }]);
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

describe('days', () => {
	it('devuelve los días distintos, en orden', () => {
		expect(
			days([
				{ day: '2026-10-15', hour: 0, kwh: 1 },
				{ day: '2026-10-14', hour: 1, kwh: 1 },
				{ day: '2026-10-14', hour: 0, kwh: 1 }
			])
		).toEqual(['2026-10-14', '2026-10-15']);
	});
});

describe('madridNow', () => {
	it('da el día y la hora de Madrid, en verano y en invierno', () => {
		expect(madridNow(Date.parse('2026-10-14T22:30:00Z'))).toEqual({ day: '2026-10-15', hour: 0 });
		expect(madridNow(Date.parse('2026-12-31T23:10:00Z'))).toEqual({ day: '2027-01-01', hour: 0 });
		expect(madridNow(Date.parse('2026-10-14T10:59:00Z'))).toEqual({ day: '2026-10-14', hour: 12 });
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
