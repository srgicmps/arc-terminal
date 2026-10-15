import { describe, expect, it } from 'vitest';
import { calendar, earningsEvent, escape, fold, meetingEvent, releaseEvent } from './ics.ts';

describe('agenda .ics', () => {
	it('escapa y parte las líneas largas', () => {
		expect(escape('a, b; c\\d\ne')).toBe('a\\, b\\; c\\\\d\\ne');
		const line = 'X'.repeat(80);
		expect(fold(line)).toBe(`${'X'.repeat(75)}\r\n ${'X'.repeat(5)}`);
		// Nunca parte una letra con tilde por la mitad (cuenta octetos).
		expect(fold('é'.repeat(40)).split('\r\n ')[0]).toBe('é'.repeat(37));
	});

	it('escribe la decisión del BCE en UTC con la hora de Madrid en la descripción', () => {
		const e = meetingEvent({ bank: 'ecb', date: '2026-10-29', at: '2026-10-29T13:15:00.000Z' });
		expect(e.title).toBe('BCE: decisión de tipos');
		expect(e.description).toContain('14:15 (hora de Madrid)');
		const ics = calendar([e], '2026-10-15T08:00:00Z');
		expect(ics).toContain('DTSTART:20261029T131500Z');
		expect(ics).toContain('UID:cb-ecb-2026-10-29@srgicmps.github.io');
		expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
		expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
	});

	it('los resultados y los datos sin hora son de día entero', () => {
		const ics = calendar(
			[
				earningsEvent({ date: '2026-10-21', symbol: 'TSLA', hour: 'amc', quarter: 3, year: 2026, epsEstimate: null, epsActual: null, revenueEstimate: null, revenueActual: null }),
				releaseEvent({ date: '2026-10-30T00:00:00Z', allDay: true, title: 'IPC adelantado', source: 'INE', topic: 'ipc' })
			],
			'2026-10-15T08:00:00Z'
		);
		expect(ics).toContain('SUMMARY:Resultados TSLA T3 2026');
		expect(ics).toContain('DTSTART;VALUE=DATE:20261021\r\nDTEND;VALUE=DATE:20261022');
		expect(ics).toContain('DESCRIPTION:Publica tras el cierre de Wall Street');
		expect(ics).toContain('DTSTART;VALUE=DATE:20261030');
	});
});
