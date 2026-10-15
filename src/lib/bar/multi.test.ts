import { describe, expect, it } from 'vitest';
import { MULTI_MAX, parseMulti } from './multi.ts';

describe('varios a la vez', () => {
	it('separa por punto y coma', () => {
		expect(parseMulti('ECO; WS CURVA')).toEqual(['ECO', 'WS CURVA']);
		expect(parseMulti(' ECO ;; NVDA 1a ; ')).toEqual(['ECO', 'NVDA 1a']);
		expect(parseMulti('ECO;')).toBeNull();
		expect(parseMulti('ECO')).toBeNull();
		expect(parseMulti(Array(20).fill('ECO').join(';'))).toHaveLength(MULTI_MAX);
	});
});
