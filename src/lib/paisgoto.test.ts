import { describe, expect, it } from 'vitest';
import { findCountry } from './countries.ts';
import { goTo } from './paisgoto.ts';

const es = findCountry('ES')!;
const jp = findCountry('JP')!;
const de = findCountry('DE')!;

describe('fila «Ir a» de PAIS', () => {
	it('titulares del país, sus vistas y GEO y CAL', () => {
		expect(goTo(jp).map((g) => g.code)).toEqual(['NEWS', 'GEO', 'CAL']);
		expect(goTo(jp)[0].query).toBe('q=Jap%C3%B3n');
		expect(goTo(es).map((g) => g.code)).toEqual(['NEWS', 'ES', 'ECO', 'GEO', 'CAL']);
	});

	it('detrás, tus otros países', () => {
		expect(goTo(de, [jp, de]).slice(-1)).toEqual([{ code: 'JP', route: '/pais', query: 'c=JP', what: 'Ficha de Japón' }]);
	});
});
