import { describe, expect, it } from 'vitest';
import { due, isAlarms, minutesUntil, stopwatchText, untilText, type Alarm } from './alarms.ts';

const a = (time: string, days: number[] = [], on = true): Alarm => ({ id: time, time, label: '', on, days });
// Miércoles 14-10-2026, 07:30 (hora local).
const wed = new Date(2026, 9, 14, 7, 30, 20);

describe('Alarmas del Reloj', () => {
	it('suenan en su minuto y en sus días', () => {
		expect(due([a('07:30'), a('07:31'), a('07:30', [], false)], wed).map((x) => x.id)).toEqual(['07:30']);
		expect(due([a('07:30', [1, 2]), a('07:30', [3])], wed)).toHaveLength(1);
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
