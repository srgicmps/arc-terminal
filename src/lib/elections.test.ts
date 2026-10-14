// Próximas elecciones: qué países se destacan (G20 y UE).
import { describe, expect, it } from 'vitest';
import { EU, G20, isMajor, KIND_LABEL } from './elections.ts';

describe('isMajor', () => {
	it('destaca los países del G20 y de la UE', () => {
		expect(isMajor({ iso: 'US' })).toBe(true);
		expect(isMajor({ iso: 'BR' })).toBe(true);
		expect(isMajor({ iso: 'ES' })).toBe(true);
		expect(isMajor({ iso: 'gr' })).toBe(true);
	});

	it('no destaca el resto ni los que no tienen código', () => {
		expect(isMajor({ iso: 'CL' })).toBe(false);
		expect(isMajor({ iso: 'NO' })).toBe(false);
		expect(isMajor({ iso: null })).toBe(false);
	});

	it('las listas tienen 19 y 27 países', () => {
		expect(G20.size).toBe(19);
		expect(EU.size).toBe(27);
	});

	it('cada tipo tiene su nombre', () => {
		expect(KIND_LABEL.referendum).toBe('Referéndum');
	});
});
