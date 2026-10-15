import { describe, expect, it } from 'vitest';
import { due, dueBetween, isAlarms, minutesUntil, stopwatchText, untilText, type Alarm } from './alarms.ts';

const a = (time: string, days: number[] = [], on = true): Alarm => ({ id: time, time, label: '', on, days });
// Miércoles 14-10-2026, 07:30 (hora local).
const wed = new Date(2026, 9, 14, 7, 30, 20);

describe('Alarmas del Reloj', () => {
	it('suenan en su minuto y en sus días', () => {
		expect(due([a('07:30'), a('07:31'), a('07:30', [], false)], wed).map((x) => x.id)).toEqual(['07:30']);
		expect(due([a('07:30', [1, 2]), a('07:30', [3])], wed)).toHaveLength(1);
	});

	it('no se pierden si el reloj que mira se salta su minuto', () => {
		const list = [a('07:30'), a('07:31'), a('07:40'), a('07:30', [4])];
		// La pestaña dormida mira a las 07:29:50 y luego a las 07:31:20: suenan las dos de en medio.
		const ids = dueBetween(list, new Date(2026, 9, 14, 7, 29, 50), new Date(2026, 9, 14, 7, 31, 20)).map((x) => x.id);
		expect(ids.sort()).toEqual(['07:30', '07:31']);
		// La alarma del minuto en que se mira suena una sola vez.
		expect(dueBetween(list, new Date(2026, 9, 14, 7, 30, 5), new Date(2026, 9, 14, 7, 30, 10))).toHaveLength(0);
		// Más de MAX_LATE_MIN tarde (ordenador en reposo toda la noche): ya no suena.
		expect(dueBetween(list, new Date(2026, 9, 14, 7, 0), new Date(2026, 9, 14, 7, 55))).toHaveLength(0);
		expect(dueBetween(list, new Date(2026, 9, 14, 7, 0), new Date(2026, 9, 14, 7, 45)).map((x) => x.id)).toEqual(['07:40']);
		// Pasar de medianoche cambia el día de la semana.
		const night = [a('23:59', [3]), a('00:00', [4])];
		expect(dueBetween(night, new Date(2026, 9, 14, 23, 58, 30), new Date(2026, 9, 15, 0, 0, 30)).map((x) => x.id).sort()).toEqual(['00:00', '23:59']);
	});

	it('dicen cuánto falta', () => {
		expect(minutesUntil(a('08:00'), wed)).toBe(30);
		expect(minutesUntil(a('07:00'), wed)).toBe(1410);
		expect(minutesUntil(a('07:30', [4]), wed)).toBe(1440);
		expect(minutesUntil(a('08:00', [], false), wed)).toBeNull();
		expect(untilText(30)).toBe('En 30 min');
		expect(untilText(1410)).toBe('En 23 h 30 min');
	});

	it('valida lo guardado', () => {
		expect(isAlarms([a('07:30')])).toBe(true);
		expect(isAlarms([{ time: '7:30' }])).toBe(false);
		expect(isAlarms('x')).toBe(false);
	});

	it('formatea el cronómetro', () => {
		expect(stopwatchText(3723400)).toBe('01:02:03,4');
		expect(stopwatchText(59999, false)).toBe('00:00:59');
	});
});
