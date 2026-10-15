import { describe, expect, it } from 'vitest';
import { flopPct, flops } from './epoch.ts';

describe('flops', () => {
	it('escribe la potencia de diez', () => {
		expect(flops(9.4e26)).toBe('9,4·10²⁶');
		expect(flops(5.0000000000001e26)).toBe('5,0·10²⁶');
		expect(flops(3e24)).toBe('3,0·10²⁴');
		expect(flops(null)).toBe('—');
	});
});

describe('flopPct', () => {
	it('va en escala logarítmica desde 10²³ hasta el récord', () => {
		expect(flopPct(1e27, 1e27)).toBe(100);
		expect(flopPct(1e25, 1e27)).toBe(50);
		expect(flopPct(1e22, 1e27)).toBe(0);
		expect(flopPct(null, 1e27)).toBe(0);
	});
});
