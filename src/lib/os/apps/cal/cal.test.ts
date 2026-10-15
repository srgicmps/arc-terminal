import { describe, expect, it } from 'vitest';
import { bareSymbol, dayItems, isEvents, isoDay, kindsOf, monthGrid, type CalFeed } from './cal.ts';

const feed: CalFeed = {
	holidays: [{ date: '2026-10-12', name: 'Fiesta Nacional', scope: 'ES' }],
	releases: [{ date: '2026-10-12T12:30:00Z', allDay: true, title: 'IPC', source: 'BLS' }],
	earnings: [
		{ date: '2026-10-12', symbol: 'NVDA', hour: 'amc' },
		{ date: '2026-10-12', symbol: 'KO', hour: '' }
	]
};

describe('Calendario', () => {
	it('la rejilla empieza en lunes', () => {
		const g = monthGrid(2026, 9);
		expect(g).toHaveLength(42);
		expect(isoDay(g[0])).toBe('2026-09-28');
		expect(isoDay(g[3])).toBe('2026-10-01');
	});

	it('junta lo de cada día y filtra los resultados por MIS', () => {
		const ev = [{ id: 'x', date: '2026-10-12', time: '09:00', title: 'Dentista' }];
		const all = dayItems('2026-10-12', feed, ev, [], null);
		expect(all.map((i) => i.kind)).toEqual(['fiesta', 'dato', 'resultado', 'resultado', 'tuyo']);
		expect(all[2].text).toBe('Resultados NVDA · al cierre');
		const mine = dayItems('2026-10-12', feed, [], [], new Set(['NVDA']));
		expect(mine.filter((i) => i.kind === 'resultado')).toHaveLength(1);
		expect(kindsOf(all)).toEqual(['fiesta', 'dato', 'resultado', 'tuyo']);
	});

	it('las alarmas que se repiten salen en sus días', () => {
		const alarm = { id: 'a', time: '07:00', label: 'Gym', on: true, days: [1] };
		const now = new Date(2026, 9, 12, 8);
		expect(dayItems('2026-10-12', null, [], [alarm], null, now)).toEqual([{ kind: 'alarma', time: '07:00', text: 'Gym' }]);
		expect(dayItems('2026-10-13', null, [], [alarm], null, now)).toEqual([]);
		expect(dayItems('2026-10-19', null, [], [alarm], null, now)).toHaveLength(1);
		// En los días pasados no salen.
		expect(dayItems('2026-10-05', null, [], [alarm], null, now)).toEqual([]);
	});

	it('una alarma de una vez sale hoy o, si ya pasó su hora, mañana', () => {
		const once = { id: 'b', time: '07:00', label: '', on: true, days: [] };
		expect(dayItems('2026-10-12', null, [], [once], null, new Date(2026, 9, 12, 6))).toEqual([{ kind: 'alarma', time: '07:00', text: 'Alarma' }]);
		expect(dayItems('2026-10-12', null, [], [once], null, new Date(2026, 9, 12, 8))).toEqual([]);
		expect(dayItems('2026-10-13', null, [], [once], null, new Date(2026, 9, 12, 8))).toHaveLength(1);
		// Pasada la medianoche, «hoy» es otro día: por eso la app le pasa la hora actual, no la de cuando se abrió.
		expect(dayItems('2026-10-13', null, [], [once], null, new Date(2026, 9, 13, 0, 5))).toHaveLength(1);
	});

	it('los datos de todo el día caen en su día, sea cual sea la zona horaria', () => {
		const f: CalFeed = { holidays: [], releases: [{ date: '2026-10-30T00:00:00Z', allDay: true, title: 'IPC', source: 'INE' }], earnings: [] };
		expect(dayItems('2026-10-30', f, [], [], null).map((i) => i.text)).toEqual(['IPC · INE']);
		expect(dayItems('2026-10-29', f, [], [], null)).toEqual([]);
	});

	it('valida y limpia', () => {
		expect(isEvents([{ id: 'x', date: '2026-10-12', time: '', title: 'a' }])).toBe(true);
		expect(isEvents([{ id: 'x', date: '12/10', time: '', title: 'a' }])).toBe(false);
		expect(bareSymbol('NASDAQ:nvda')).toBe('NVDA');
	});
});
