import { describe, expect, it } from 'vitest';
import { bmeHolidays, easter, nyseHolidays } from './markets.ts';

const dates = (list: { date: string }[]) => list.map((h) => h.date);

describe('markets', () => {
	it('calcula el domingo de Pascua', () => {
		expect(easter(2024)).toEqual({ m: 3, d: 31 });
		expect(easter(2025)).toEqual({ m: 4, d: 20 });
		expect(easter(2026)).toEqual({ m: 4, d: 5 });
		expect(easter(2027)).toEqual({ m: 3, d: 28 });
	});

	it('NYSE 2026: el 4 de julio cae en sábado y se cierra el viernes 3', () => {
		expect(dates(nyseHolidays(2026))).toEqual([
			'2026-01-01',
			'2026-01-19',
			'2026-02-16',
			'2026-04-03',
			'2026-05-25',
			'2026-06-19',
			'2026-07-03',
			'2026-09-07',
			'2026-11-26',
			'2026-12-25'
		]);
	});

	it('NYSE 2027: Navidad en sábado se cierra el 24 y Juneteenth el 18', () => {
		const list = dates(nyseHolidays(2027));
		expect(list).toContain('2027-12-24');
		expect(list).toContain('2027-06-18');
		expect(list).toContain('2027-07-05');
		expect(list).toContain('2027-03-26');
	});

	it('NYSE 2022: Año Nuevo en sábado no se recupera', () => {
		expect(dates(nyseHolidays(2022))[0]).toBe('2022-01-17');
	});

	it('BME 2026: días sin TARGET2 que caen entre semana', () => {
		expect(dates(bmeHolidays(2026))).toEqual([
			'2026-01-01',
			'2026-04-03',
			'2026-04-06',
			'2026-05-01',
			'2026-12-25'
		]);
	});
});
