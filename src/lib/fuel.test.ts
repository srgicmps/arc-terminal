// FUEL: qué provincia abre «FUEL Madrid» o «FUEL 28», y lectura del Weekly Oil Bulletin.
import { describe, expect, it } from 'vitest';
import { findProvince, parseOilBulletin, taxShare } from './fuel.ts';

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

describe('Weekly Oil Bulletin', () => {
	const head = (kind: string) => ['title', 'CTR', `EU_price_${kind}_tax_euro95`, `EU_price_${kind}_tax_diesel`, 'CTR', `ES_price_${kind}_tax_euro95`, `ES_price_${kind}_tax_diesel`, `FR_price_${kind}_tax_euro95`];
	const withTax = [
		head('with'),
		['', '', 'Euro-super 95', 'Gas oil'],
		['Date', '', '1000 l'],
		[new Date(Date.UTC(2026, 9, 12)), 'EU_', 2009.76, 2135.88, 'ES_', 1612.4, 1598.6, 2212.22],
		['2026-10-05', 'EU_', 2006.33, 2148.53, 'ES_', 1600, 1590, 2200]
	];
	const noTax = [head('wo'), ['2026-10-12', 'EU_', 1100, 1300, 'ES_', 900.4, 1000, null]];

	it('la semana más reciente, en €/L, con y sin impuestos', () => {
		const data = parseOilBulletin([withTax, noTax, [['Consumption']]]);
		expect(data?.date).toBe('2026-10-12');
		expect(data?.rows.map((r) => r.code)).toEqual(['ES', 'FR', 'EU']);
		expect(data?.rows[0]).toEqual({ code: 'ES', name: 'España', g95: { tax: 1.612, net: 0.9 }, diesel: { tax: 1.599, net: 1 } });
		expect(data?.rows[1].g95).toEqual({ tax: 2.212, net: null });
	});

	it('sin columnas de precios, null', () => {
		expect(parseOilBulletin([[['a', 'b'], ['2026-10-12', 1]]])).toBeNull();
	});

	it('calcula la parte del precio que son impuestos', () => {
		expect(taxShare({ tax: 1.6, net: 0.8 })).toBe(50);
		expect(taxShare({ tax: 1.5, net: null })).toBeNull();
		expect(taxShare({ tax: null, net: 0.8 })).toBeNull();
	});
});
