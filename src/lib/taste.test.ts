import { describe, expect, it } from 'vitest';
import { cleanCodes } from './taste.ts';

describe('cleanCodes', () => {
	it('quita lo que no es un comando, lo repetido, y ordena como COMMANDS', () => {
		expect(cleanCodes(['WS', 'NOPE', 'TOP', 'WS', 3])).toEqual(['TOP', 'WS']);
	});
	it('respeta el máximo y devuelve null si no queda nada', () => {
		expect(cleanCodes(['TOP', 'ECO', 'GEO', 'WS', 'FUEL'], 4)).toHaveLength(4);
		expect(cleanCodes([])).toBeNull();
		expect(cleanCodes('TOP')).toBeNull();
	});
});
