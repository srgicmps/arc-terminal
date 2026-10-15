import { describe, expect, it } from 'vitest';
import { quakePlace } from './quakeplace.ts';

describe('quakePlace', () => {
	it('pasa al español la parte en inglés', () => {
		expect(quakePlace('98 km SSW of Neiafu, Tonga')).toBe('98 km al SSO de Neiafu, Tonga');
		expect(quakePlace('5 km W of Cobb, CA')).toBe('5 km al O de Cobb, CA');
		expect(quakePlace('near the coast of Central Chile')).toBe('cerca de la costa de Central Chile');
		expect(quakePlace('south of the Fiji Islands')).toBe('al sur de Fiji Islands');
	});
	it('deja igual lo que no reconoce', () => {
		expect(quakePlace('Fiji region')).toBe('Fiji region');
		expect(quakePlace('Kermadec Islands, New Zealand')).toBe('Kermadec Islands, New Zealand');
	});
});
