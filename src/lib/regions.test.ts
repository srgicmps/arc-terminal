import { describe, expect, it } from 'vitest';
import { COUNTRIES } from './countries.ts';
import { inRegion, regionOf, regionsOf } from './regions.ts';

describe('regions', () => {
	it('todos los países tienen región', () => {
		expect(COUNTRIES.filter((c) => !regionOf(c.code)).map((c) => c.code)).toEqual([]);
	});

	it('un titular cae en las regiones de los países que nombra', () => {
		expect(regionsOf('Israel strikes Lebanon as Iran warns the US')).toEqual(['oriente', 'america']);
		expect(regionsOf('La UE y Alemania')).toEqual(['europa']);
		expect(regionsOf('Sin países')).toEqual([]);
	});

	it('filtra por región', () => {
		const items = [{ title: 'Elecciones en Brasil' }, { title: 'Ucrania y Rusia' }, { title: 'Tiempo' }];
		expect(inRegion(items, 'america').map((i) => i.title)).toEqual(['Elecciones en Brasil']);
		expect(inRegion(items, 'all')).toHaveLength(3);
	});
});
