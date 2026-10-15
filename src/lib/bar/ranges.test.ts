// Periodos, comparaciones y rentabilidad desde la barra.
import { describe, expect, it } from 'vitest';
import { compareInput, parsePeriod, rangeInterval, rangeSince, sinceInput, symbolOf, symbolRange } from './ranges.ts';

describe('periodos', () => {
	it('entiende 1a, 5d, 3m, 6 meses, ytd y max', () => {
		expect(parsePeriod('1a')?.range.tv).toBe('12M');
		expect(parsePeriod('5d')?.range.tv).toBe('5D');
		expect(parsePeriod('3m')?.range.tv).toBe('3M');
		expect(parsePeriod('6 meses')?.range.tv).toBe('6M');
		expect(parsePeriod('2 años')?.range.tv).toBe('60M');
		expect(parsePeriod('10a')).toMatchObject({ range: { tv: 'ALL' }, days: 3653 });
		expect(parsePeriod('ytd')?.range.tv).toBe('YTD');
		expect(parsePeriod('60M')?.range.tv).toBe('60M');
		expect(parsePeriod('max')?.range.tv).toBe('ALL');
		expect(parsePeriod('GP')).toBeNull();
		expect(parsePeriod('0d')).toBeNull();
		expect(rangeInterval('1D')).toBe('5');
		expect(rangeInterval('12M')).toBe('D');
	});

	it('el valor con su rango, nunca un comando', () => {
		expect(symbolOf('nvda')).toBe('NVDA');
		expect(symbolOf('ibex')).toBe('IBEX');
		expect(symbolOf('ECO')).toBeNull();
		expect(symbolRange('NVDA 1a')).toEqual({ route: '/s', search: '?sym=NVDA&rango=12M', code: 'NVDA 12M', desc: 'Gráfico de NVIDIA, 1 año' });
		expect(symbolRange('IBEX 5d')?.search).toBe('?sym=IBEX&rango=5D');
		expect(symbolRange('NVDA GP')).toBeNull();
		expect(symbolRange('ECO 1a')).toBeNull();
	});
});

describe('comparar', () => {
	it('dos o más valores, con rango si lo hay', () => {
		expect(compareInput('NVDA vs AMD')).toMatchObject({ route: '/cmp', search: '?s=NVDA%20AMD', desc: 'Comparar NVDA, AMD' });
		expect(compareInput('nvda vs amd vs avgo 5a')?.search).toBe('?s=NVDA%20AMD%20AVGO&rango=60M');
		expect(compareInput('ES vs IT paro')).toBeNull();
		expect(compareInput('NVDA')).toBeNull();
	});
});

describe('rentabilidad desde una fecha', () => {
	it('lee el valor y el día', () => {
		expect(sinceInput('NVDA desde 2024-01-01')).toEqual({ sym: 'NVDA', date: '2024-01-01' });
		expect(sinceInput('nvda desde 1/3/2025')).toEqual({ sym: 'NVDA', date: '2025-03-01' });
		expect(sinceInput('ECO desde 2024-01-01')).toBeNull();
		expect(rangeSince('2024-01-01', Date.parse('2026-10-15T00:00:00Z')).tv).toBe('60M');
		expect(rangeSince('2026-09-01', Date.parse('2026-10-15T00:00:00Z')).tv).toBe('3M');
	});
});

describe('texto que no son valores (QA T7)', () => {
	it('líderes y países no se comparan ni se grafican', () => {
		expect(compareInput('biden vs trump')).toBeNull();
		expect(compareInput('otan vs rusia')).toBeNull();
		expect(symbolRange('trump 1a')).toBeNull();
		expect(compareInput('NVDA vs AMD')?.route).toBe('/cmp');
		expect(symbolRange('smci 1a')?.route).toBe('/s');
	});
});
