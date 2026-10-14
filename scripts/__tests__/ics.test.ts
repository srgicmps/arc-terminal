import { describe, expect, it } from 'vitest';
import { parseIcs, parseIcsDate, zonedToUtc } from '../ics.ts';

describe('ics', () => {
	it('pasa horas locales a UTC con el cambio de hora', () => {
		// Madrid: verano UTC+2, invierno UTC+1 (el cambio de 2026 es el 25 de octubre).
		expect(zonedToUtc(2026, 10, 14, 9, 0, 'Europe/Madrid').toISOString()).toBe('2026-10-14T07:00:00.000Z');
		expect(zonedToUtc(2026, 10, 30, 9, 0, 'Europe/Madrid').toISOString()).toBe('2026-10-30T08:00:00.000Z');
		// Nueva York: el BLS publica a las 8:30.
		expect(zonedToUtc(2026, 11, 13, 8, 30, 'America/New_York').toISOString()).toBe('2026-11-13T13:30:00.000Z');
	});

	it('lee las fechas de DTSTART en sus tres formas', () => {
		expect(parseIcsDate('', '20261030T100000Z')?.date.toISOString()).toBe('2026-10-30T10:00:00.000Z');
		expect(parseIcsDate('TZID=America/New_York', '20261113T083000')?.date.toISOString()).toBe(
			'2026-11-13T13:30:00.000Z'
		);
		expect(parseIcsDate('VALUE=DATE', '20261030')).toEqual({
			date: new Date('2026-10-29T23:00:00.000Z'),
			allDay: true
		});
		expect(parseIcsDate('', 'mañana')).toBeNull();
	});

	it('lee los eventos, con líneas dobladas y escapes', () => {
		const ics = [
			'BEGIN:VCALENDAR',
			'BEGIN:VEVENT',
			'DTSTART;TZID=Europe/Luxembourg:20261030T110000',
			'SUMMARY:Euro area annual inflation\\, flash estimate - October 20',
			' 26',
			'URL:https://example.org/a',
			'END:VEVENT',
			'BEGIN:VEVENT',
			'SUMMARY:Sin fecha',
			'END:VEVENT',
			'END:VCALENDAR'
		].join('\r\n');
		expect(parseIcs(ics)).toEqual([
			{
				start: '2026-10-30T10:00:00.000Z',
				allDay: false,
				summary: 'Euro area annual inflation, flash estimate - October 2026',
				description: '',
				url: 'https://example.org/a'
			}
		]);
	});
});
