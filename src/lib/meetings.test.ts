// Reuniones del BCE y de la Fed: próxima reunión, días que faltan y lectura de Polymarket.
import { describe, expect, it } from 'vitest';
import { daysBetween, decisionTime, inDays, madridDate, MEETINGS, meetingOdds, upcoming } from './meetings.ts';
import type { Prediction } from './types.ts';

const market = (title: string, outcomes: [string, number][], endDate = ''): Prediction => ({
	id: title,
	title,
	url: `https://polymarket.com/event/${title.length}`,
	volume24h: 0,
	endDate,
	outcomes: outcomes.map(([label, p]) => ({ label, p }))
});

describe('calendario', () => {
	it('tiene 8 reuniones al año de cada banco, ordenadas', () => {
		for (const bank of ['ecb', 'fed'] as const)
			for (const year of ['2026', '2027'])
				expect(MEETINGS.filter((m) => m.bank === bank && m.date.startsWith(year))).toHaveLength(8);
		const dates = MEETINGS.map((m) => m.date);
		expect(dates).toEqual([...dates].sort());
	});

	it('da la próxima reunión de cada banco, incluida la de hoy', () => {
		expect(upcoming('2026-10-14', 'ecb')[0].date).toBe('2026-10-29');
		expect(upcoming('2026-10-14', 'fed')[0].date).toBe('2026-10-28');
		expect(upcoming('2026-10-29', 'ecb')[0].date).toBe('2026-10-29');
		expect(upcoming('2028-01-01')).toEqual([]);
	});

	it('cuenta los días y los dice en castellano', () => {
		expect(daysBetween('2026-10-14', '2026-10-29')).toBe(15);
		// Cambio de hora de octubre por medio: siguen siendo días enteros.
		expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2);
		expect(inDays(0)).toBe('hoy');
		expect(inDays(1)).toBe('mañana');
		expect(inDays(15)).toBe('en 15 días');
	});

	it('usa la fecha de Madrid', () => {
		// 23:30 UTC del 14 son las 01:30 del 15 en Madrid.
		expect(madridDate(Date.parse('2026-10-14T23:30:00Z'))).toBe('2026-10-15');
	});
});

describe('meetingOdds', () => {
	const fedOct = { bank: 'fed' as const, date: '2026-10-28' };

	it('agrupa las opciones en mantener, subir y bajar', () => {
		const odds = meetingOdds(fedOct, [
			market('Bitcoin above 100k in October?', [['Sí', 0.4]]),
			market('Fed decision in October?', [
				['No change', 0.8],
				['25 bps decrease', 0.15],
				['50+ bps decrease', 0.03],
				['25+ bps increase', 0.02]
			])
		]);
		expect(odds?.hold).toBeCloseTo(0.8);
		expect(odds?.cut).toBeCloseTo(0.18);
		expect(odds?.hike).toBeCloseTo(0.02);
	});

	it('acepta el mercado por su fecha de cierre aunque no diga el mes', () => {
		const odds = meetingOdds(fedOct, [market('Next FOMC: rate cut?', [['Cut', 0.3], ['Hold', 0.7]], '2026-10-28T18:00:00Z')]);
		expect(odds?.hold).toBeCloseTo(0.7);
	});

	it('no confunde bancos ni meses', () => {
		const ecbDec = market('ECB decision in December?', [['No change', 0.9]]);
		expect(meetingOdds(fedOct, [ecbDec])).toBeNull();
		expect(meetingOdds({ bank: 'ecb', date: '2026-10-29' }, [ecbDec])).toBeNull();
		expect(meetingOdds({ bank: 'ecb', date: '2026-12-17' }, [ecbDec])?.hold).toBeCloseTo(0.9);
	});

	it('devuelve null si las opciones no se entienden', () => {
		expect(meetingOdds(fedOct, [market('Fed decision in October?', [['Powell', 0.5]])])).toBeNull();
	});
});

describe('decisionTime', () => {
	it('da la hora de Madrid, también con los cambios de hora desfasados', () => {
		expect(decisionTime({ bank: 'ecb', date: '2026-10-29' })).toBe('14:15');
		expect(decisionTime({ bank: 'fed', date: '2026-07-29' })).toBe('20:00');
		expect(decisionTime({ bank: 'fed', date: '2026-12-09' })).toBe('20:00');
		// Europa ya ha vuelto al horario de invierno (25 oct) y EE. UU. todavía no (1 nov).
		expect(decisionTime({ bank: 'fed', date: '2026-10-28' })).toBe('19:00');
		// EE. UU. adelanta la hora el 8 mar y Europa el 29 mar.
		expect(decisionTime({ bank: 'fed', date: '2026-03-18' })).toBe('19:00');
	});
});
