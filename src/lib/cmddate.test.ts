import { describe, expect, it } from 'vitest';
import { addDays, parseDay } from './cmddate.ts';

// Jueves, 15 de octubre de 2026.
const TODAY = '2026-10-15';

describe('parseDay (M49)', () => {
	it('días relativos', () => {
		expect(parseDay('hoy', TODAY)).toBe('2026-10-15');
		expect(parseDay('mañana', TODAY)).toBe('2026-10-16');
		expect(parseDay('MANANA', TODAY)).toBe('2026-10-16');
		expect(parseDay('pasado mañana', TODAY)).toBe('2026-10-17');
		expect(parseDay('ayer', TODAY)).toBe('2026-10-14');
	});

	it('el próximo día de la semana (hoy cuenta)', () => {
		expect(parseDay('viernes', TODAY)).toBe('2026-10-16');
		expect(parseDay('sábado', TODAY)).toBe('2026-10-17');
		expect(parseDay('el lunes', TODAY)).toBe('2026-10-19');
		expect(parseDay('jueves', TODAY)).toBe('2026-10-15');
		expect(parseDay('miércoles', TODAY)).toBe('2026-10-21');
	});

	it('fechas escritas', () => {
		expect(parseDay('17/10', TODAY)).toBe('2026-10-17');
		expect(parseDay('2/1', TODAY)).toBe('2027-01-02');
		expect(parseDay('31/12/2026', TODAY)).toBe('2026-12-31');
		expect(parseDay('2026-11-03', TODAY)).toBe('2026-11-03');
		expect(parseDay('30/02', TODAY)).toBeNull();
	});

	it('lo que no es fecha', () => {
		expect(parseDay('Madrid', TODAY)).toBeNull();
		expect(parseDay('Mar del Plata', TODAY)).toBeNull();
		expect(parseDay('', TODAY)).toBeNull();
	});

	it('suma días cruzando meses y años', () => {
		expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
	});
});
