import { describe, expect, it } from 'vitest';
import { offsetFromMadrid, offsetLabel, tripHolidays } from './viaje.ts';

describe('viaje (F5)', () => {
	it('diferencia horaria con Madrid', () => {
		const oct = Date.parse('2026-10-15T12:00:00Z'); // Madrid en verano (+2)
		expect(offsetFromMadrid('Asia/Tokyo', oct)).toBe(7 * 60);
		expect(offsetFromMadrid('America/New_York', oct)).toBe(-6 * 60);
		expect(offsetFromMadrid('Asia/Kolkata', oct)).toBe(3 * 60 + 30);
		expect(offsetFromMadrid('Europe/Madrid', oct)).toBe(0);
		expect(offsetFromMadrid('No/Existe', oct)).toBeNull();
	});

	it('offsetLabel', () => {
		expect(offsetLabel(420)).toBe('7 h más que en Madrid');
		expect(offsetLabel(-330)).toBe('5 h 30 min menos que en Madrid');
		expect(offsetLabel(0)).toBe('la misma hora que en Madrid');
		expect(offsetLabel(null)).toBe('');
	});

	it('tripHolidays: los próximos, un día por fila', () => {
		const items = [
			{ date: '2026-11-03', name: 'Culture Day' },
			{ date: '2026-11-23', name: 'Labour Thanksgiving Day' },
			{ date: '2026-11-23', name: 'Otro', counties: ['JP-13'] },
			{ date: '2026-12-01', name: 'Local', counties: ['JP-01'] },
			{ date: '2027-02-11', name: 'Lejos' }
		];
		expect(tripHolidays(items, '2026-10-15', 60)).toEqual([
			{ date: '2026-11-03', names: ['Culture Day'], regional: false },
			{ date: '2026-11-23', names: ['Labour Thanksgiving Day', 'Otro'], regional: false },
			{ date: '2026-12-01', names: ['Local'], regional: true }
		]);
	});
});
