import { describe, expect, it } from 'vitest';
import { cleanCountries, toggleCountry } from './favcountries.ts';

describe('países favoritos', () => {
	it('añade y quita', () => {
		expect(toggleCountry(['DE'], 'JP')).toEqual(['DE', 'JP']);
		expect(toggleCountry(['DE', 'JP'], 'DE')).toEqual(['JP']);
	});

	it('con el máximo, el nuevo sustituye al más antiguo', () => {
		expect(toggleCountry(['DE', 'JP'], 'US', 2)).toEqual(['JP', 'US']);
	});

	it('limpia lo guardado', () => {
		expect(cleanCountries(['DE', 'XX', 'DE', 3, 'JP'], (c) => c !== 'XX')).toEqual(['DE', 'JP']);
		expect(cleanCountries('DE', () => true)).toEqual([]);
	});
});
