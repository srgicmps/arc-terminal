import { describe, expect, it } from 'vitest';
import { days, hourly, madridNow } from './power.ts';

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
