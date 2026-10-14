import { describe, expect, it } from 'vitest';
import { CAL_DEFAULT, calConfig, parseCalFilters } from './cal-filters.ts';

describe('cal-filters', () => {
	it('lee lo guardado y descarta lo que no conoce', () => {
		expect(parseCalFilters('{"countries":["es","xx","us"],"importance":"1"}')).toEqual({ countries: ['us', 'es'], importance: '1' });
		expect(parseCalFilters('{"countries":[],"importance":"9"}')).toEqual(CAL_DEFAULT);
		expect(parseCalFilters(null)).toEqual(CAL_DEFAULT);
		expect(parseCalFilters('no es JSON')).toEqual(CAL_DEFAULT);
	});

	it('pasa los filtros al widget; sin países, todos', () => {
		expect(calConfig({ countries: ['es', 'us'], importance: '1' })).toEqual({ importanceFilter: '1', countryFilter: 'es,us' });
		expect(calConfig({ countries: [], importance: '0,1' }).countryFilter).toBe('us,eu,es,de,fr,it,gb,cn,jp');
	});
});
