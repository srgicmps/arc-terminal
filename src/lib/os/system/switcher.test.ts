import { describe, expect, it } from 'vitest';
import type { Win } from '../wm.ts';
import { stepIndex, switchOrder, thumbRect } from './switcher.ts';

const w = (uid: string, z: number): Win => ({ uid, app: 'eco', z, x: 0, y: 0, w: 100, h: 100 });

describe('Alt+Tab', () => {
	it('ordena por uso', () => {
		expect(switchOrder([w('a', 1), w('b', 3), w('c', 2)]).map((x) => x.uid)).toEqual(['b', 'c', 'a']);
	});
	it('da la vuelta en los dos sentidos', () => {
		expect(stepIndex(2, 3, 1)).toBe(0);
		expect(stepIndex(0, 3, -1)).toBe(2);
		expect(stepIndex(0, 0, 1)).toBe(0);
	});
	it('escala al escritorio y recorta lo que sale', () => {
		expect(thumbRect({ x: 100, y: 50, w: 200, h: 100 }, { w: 1000, h: 500 })).toEqual({ left: 10, top: 10, width: 20, height: 20 });
		expect(thumbRect({ x: -50, y: 0, w: 2000, h: 500 }, { w: 1000, h: 500 })).toEqual({ left: 0, top: 0, width: 100, height: 100 });
	});
});
