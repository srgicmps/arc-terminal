// FUEL: qué provincia abre «FUEL Madrid» o «FUEL 28».
import { describe, expect, it } from 'vitest';
import { findProvince } from './fuel.ts';

// Nombres como los publica el Ministerio.
const PROVINCES = [
	{ id: '07', name: 'Balears (Illes)' },
	{ id: '28', name: 'Madrid' },
	{ id: '29', name: 'Málaga' },
	{ id: '15', name: 'Coruña (A)' }
];

describe('findProvince', () => {
	it('por número, con o sin cero delante', () => {
		expect(findProvince('28', PROVINCES)).toBe('28');
		expect(findProvince('7', PROVINCES)).toBe('07');
		expect(findProvince('99', PROVINCES)).toBeNull();
	});

	it('por nombre, sin tildes ni mayúsculas', () => {
		expect(findProvince('madrid', PROVINCES)).toBe('28');
		expect(findProvince('MALAGA', PROVINCES)).toBe('29');
		expect(findProvince('bal', PROVINCES)).toBe('07');
		expect(findProvince('coruña', PROVINCES)).toBe('15');
	});

	it('Menorca es su propia zona', () => {
		expect(findProvince('Menorca', PROVINCES)).toBe('menorca');
	});

	it('sin texto o sin coincidencia, nada', () => {
		expect(findProvince(null, PROVINCES)).toBeNull();
		expect(findProvince('  ', PROVINCES)).toBeNull();
		expect(findProvince('Narnia', PROVINCES)).toBeNull();
	});
});
