import { describe, expect, it } from 'vitest';
import { COUNTRIES, countryTicker, demonymForms, findCountries, findCountry } from './countries.ts';
import { mentions } from './news.ts';

describe('countries', () => {
	it('no repite códigos y todos tienen sus datos', () => {
		expect(new Set(COUNTRIES.map((c) => c.code)).size).toBe(COUNTRIES.length);
		expect(new Set(COUNTRIES.map((c) => c.iso3)).size).toBe(COUNTRIES.length);
		for (const c of COUNTRIES) {
			expect(c.code).toMatch(/^[A-Z]{2}$/);
			expect(c.iso3).toMatch(/^[A-Z]{3}$/);
			expect(c.currency).toMatch(/^[A-Z]{3}$/);
			expect(Math.abs(c.center[0])).toBeLessThanOrEqual(90);
			expect(Math.abs(c.center[1])).toBeLessThanOrEqual(180);
			if (c.euro) expect(c.currency).toBe('EUR');
		}
	});

	it('saca las formas del gentilicio', () => {
		expect(demonymForms('alemán')).toEqual(['alemán', 'alemana', 'alemanes', 'alemanas']);
		expect(demonymForms('francés')).toEqual(['francés', 'francesa', 'franceses', 'francesas']);
		expect(demonymForms('italiano')).toEqual(['italiano', 'italiana', 'italianos', 'italianas']);
		expect(demonymForms('español')).toEqual(['español', 'española', 'españoles', 'españolas']);
		expect(demonymForms('israelí')).toEqual(['israelí', 'israelíes', 'israelís']);
		expect(demonymForms('estadounidense')).toEqual(['estadounidense', 'estadounidenses']);
		expect(demonymForms('belga')).toEqual(['belga', 'belgas']);
	});

	it('encuentra el país por código, nombre, inglés o gentilicio, sin tildes', () => {
		expect(findCountry('DE')?.code).toBe('DE');
		expect(findCountry('deu')?.code).toBe('DE');
		expect(findCountry('Alemania')?.code).toBe('DE');
		expect(findCountry('germany')?.code).toBe('DE');
		expect(findCountry('japon')?.code).toBe('JP');
		expect(findCountry('franceses')?.code).toBe('FR');
		expect(findCountry('EE. UU.')?.code).toBe('US');
		expect(findCountry('reino')?.code).toBe('GB');
		expect(findCountry('Narnia')).toBeUndefined();
		expect(findCountry('')).toBeUndefined();
	});

	it('los titulares nombran el país por su nombre o su gentilicio', () => {
		const item = (title: string) => ({ title, url: title, source: 'X', time: null, summary: '' });
		const items = ['La economía alemana se estanca', 'Berlin cuts spending', 'Alemania y Francia', 'Un germanófilo'].map(item);
		expect(mentions(items, countryTicker(findCountry('DE')!)).map((i) => i.title)).toEqual([
			'La economía alemana se estanca',
			'Berlin cuts spending',
			'Alemania y Francia'
		]);
		// «China» con mayúscula: «la vajilla de china» no cuenta… pero el gentilicio sí, en minúscula.
		const cn = countryTicker(findCountry('CN')!);
		expect(mentions([item('Aranceles a China'), item('Exportaciones chinas'), item('Paris attack')], cn)).toHaveLength(2);
	});
});

describe('findCountries', () => {
	const codes = (t: string) => findCountries(t).map((c) => c.code);
	it('todos los países de un texto largo, en orden y sin repetir', () => {
		expect(codes('Notice of OFAC Sanctions Actions; Russia-related Designations')).toEqual(['RU']);
		expect(codes('Irán amenaza a Israel; EE. UU. pide calma a los iraníes')).toEqual(['IR', 'IL', 'US']);
		expect(codes('Sin países aquí')).toEqual([]);
	});

	it('el nombre largo gana: Corea del Norte no es también Corea del Sur, South Africa no es Africa', () => {
		expect(codes('North Korea fires missile toward South Korea')).toEqual(['KP', 'KR']);
		expect(codes('Elections in South Africa')).toEqual(['ZA']);
	});
});
