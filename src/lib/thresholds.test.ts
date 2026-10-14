import { describe, expect, it } from 'vitest';
import { cleanRules, crossed, hits, parseNumber } from './thresholds.ts';

describe('umbrales', () => {
	it('cruza por encima o por debajo', () => {
		expect(crossed({ op: '>', v: 3, name: 'x' }, 3.1)).toBe(true);
		expect(crossed({ op: '>', v: 3, name: 'x' }, 3)).toBe(false);
		expect(crossed({ op: '<', v: 3, name: 'x' }, 2.9)).toBe(true);
	});
	it('cuenta solo las reglas con dato visto y cruzado', () => {
		const rules = { a: { op: '>' as const, v: 1, name: 'A', last: 2 }, b: { op: '>' as const, v: 1, name: 'B' }, c: { op: '<' as const, v: 1, name: 'C', last: 2 } };
		expect(hits(rules).map(([id]) => id)).toEqual(['a']);
	});
	it('limpia lo guardado', () => {
		expect(cleanRules({ a: { op: '>', v: 2 }, b: { op: '=', v: 1 }, c: { op: '<', v: 'x' } })).toEqual({ a: { op: '>', v: 2, name: 'a' } });
		expect(cleanRules([])).toEqual({});
	});
	it('lee números con coma o punto', () => {
		expect(parseNumber(' 1,5 ')).toBe(1.5);
		expect(parseNumber('-2')).toBe(-2);
		expect(parseNumber('abc')).toBeNull();
	});
});
