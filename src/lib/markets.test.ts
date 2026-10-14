import { describe, expect, it } from 'vitest';
import { bmeHolidays, CLOCK_MARKETS, clockState, easter, lseHolidays, nyseHolidays } from './markets.ts';

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

	it('LSE: Navidad en sábado pasa al lunes 27 y San Esteban al martes 28 (2027)', () => {
		expect(dates(lseHolidays(2027))).toEqual([
			'2027-01-01',
			'2027-03-26',
			'2027-03-29',
			'2027-05-03',
			'2027-05-31',
			'2027-08-30',
			'2027-12-27',
			'2027-12-28'
		]);
		// 2028: Año Nuevo en sábado → lunes 3; Navidad lunes y San Esteban martes.
		expect(dates(lseHolidays(2028))).toContain('2028-01-03');
		expect(dates(lseHolidays(2028)).slice(-2)).toEqual(['2028-12-25', '2028-12-26']);
	});

	describe('reloj de bolsas', () => {
		const market = (code: string) => CLOCK_MARKETS.find((m) => m.code === code)!;
		const at = (iso: string) => Date.parse(iso);

		it('un martes normal: Nueva York abierta a las 10:00 y Madrid cerrada a las 18:00', () => {
			// 14 oct 2026, 16:00 Madrid = 10:00 Nueva York (las dos en horario de verano).
			expect(clockState(market('NYC'), at('2026-10-14T14:00:00Z'))).toEqual({ time: '10:00', isOpen: true, holiday: null });
			expect(clockState(market('MAD'), at('2026-10-14T16:00:00Z'))).toEqual({ time: '18:00', isOpen: false, holiday: null });
		});

		it('Navidad: Nueva York y Londres cerradas por festivo en horario de sesión', () => {
			expect(clockState(market('NYC'), at('2026-12-25T15:00:00Z'))).toEqual({ time: '10:00', isOpen: false, holiday: 'Navidad' });
			expect(clockState(market('LON'), at('2026-12-25T10:00:00Z'))).toEqual({ time: '10:00', isOpen: false, holiday: 'Navidad' });
		});

		it('Lunes de Pascua: Madrid cerrada por festivo y Nueva York abierta', () => {
			expect(clockState(market('MAD'), at('2026-04-06T08:00:00Z'))).toEqual({
				time: '10:00',
				isOpen: false,
				holiday: 'Lunes de Pascua'
			});
			expect(clockState(market('NYC'), at('2026-04-06T15:00:00Z')).isOpen).toBe(true);
		});

		it('el festivo se mira con la fecha local de la bolsa, no con la de Madrid', () => {
			// 4 jul 2025 (viernes), 23:30 en Nueva York = 5:30 del sábado en Madrid: sigue siendo el festivo.
			expect(clockState(market('NYC'), at('2025-07-05T03:30:00Z')).holiday).toBe('Día de la Independencia');
		});

		it('Tokio cierra a mediodía y los fines de semana', () => {
			expect(clockState(market('TYO'), at('2026-10-14T02:30:00Z')).isOpen).toBe(false); // 11:30
			expect(clockState(market('TYO'), at('2026-10-14T04:00:00Z')).isOpen).toBe(true); // 13:00
			expect(clockState(market('TYO'), at('2026-10-17T04:00:00Z')).isOpen).toBe(false); // sábado
		});
	});
});
