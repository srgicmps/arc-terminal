// FUEL: qué provincia abre «FUEL Madrid» o «FUEL 28», y lectura del Weekly Oil Bulletin.
import { describe, expect, it } from 'vitest';
import { findProvince, nearestZone, parseOilBulletin, taxShare, zoneFor } from './fuel.ts';

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

describe('zoneFor', () => {
	const at = (name: string, admin2: string | undefined, lat = 40, lon = -3, cc = 'ES') => ({ name, cc, lat, lon, admin2 });
	it('la provincia de «Tu sitio», también con el nombre al revés que el Ministerio', () => {
		expect(zoneFor(at('Madrid', 'Madrid'), PROVINCES)).toBe('28');
		expect(zoneFor(at('Palma', 'Illes Balears', 39.57, 2.65), PROVINCES)).toBe('07');
		expect(zoneFor(at('Santiago', 'A Coruña', 42.88, -8.54), PROVINCES)).toBe('15');
	});

	it('Menorca por coordenadas; fuera de España o sin provincia que encaje, null', () => {
		expect(zoneFor(at('Maó', 'Illes Balears', 39.89, 4.26), PROVINCES)).toBe('menorca');
		expect(zoneFor(at('Tokio', undefined, 35.69, 139.69, 'JP'), PROVINCES)).toBeNull();
		expect(zoneFor(at('Soria', 'Soria'), PROVINCES)).toBeNull();
	});
});

describe('nearestZone', () => {
	const provinces = [
		{ id: '28', lat: 40.42, lon: -3.7 },
		{ id: '07', lat: 39.57, lon: 2.65 },
		{ id: '17', lat: 42.0, lon: 2.8 }
	];
	it('en Menorca, Menorca aunque Mallorca esté cerca', () => {
		expect(nearestZone({ lat: 39.89, lon: 4.26 }, provinces)).toBe('menorca');
	});
	it('en España, la provincia con el centro más cercano', () => {
		expect(nearestZone({ lat: 40.45, lon: -3.68 }, provinces)).toBe('28');
		expect(nearestZone({ lat: 41.9, lon: 2.7 }, provinces)).toBe('17');
	});
	it('fuera de España (París), ninguna: antes abría Girona a 700 km', () => {
		expect(nearestZone({ lat: 48.85, lon: 2.35 }, provinces)).toBeNull();
	});
	it('sin provincias, ninguna', () => {
		expect(nearestZone({ lat: 40.45, lon: -3.68 }, [])).toBeNull();
	});
});
