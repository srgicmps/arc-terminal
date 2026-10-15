import { describe, expect, it } from 'vitest';
import { busy, bytes, fps, niceMax, paths, rate, Ring } from './resources.ts';

describe('Recursos del Monitor', () => {
	it('el buffer circular guarda solo las últimas muestras, en orden', () => {
		const r = new Ring(3);
		expect(r.last()).toBeNull();
		[1, 2, 3, 4, 5].forEach((v) => r.push(v));
		expect(r.values()).toEqual([3, 4, 5]);
		expect(r.length).toBe(3);
		expect(r.last()).toBe(5);
		r.clear();
		expect(r.values()).toEqual([]);
	});

	it('tasas, FPS y carga', () => {
		expect(rate(1000, 3000, 2000)).toBe(1000);
		expect(rate(3000, 1000, 1000)).toBe(0);
		expect(rate(0, 10, 0)).toBe(0);
		expect(fps(60, 1000)).toBe(60);
		expect(fps(30, 500)).toBe(60);
		expect(busy(250, 1000)).toBe(25);
		expect(busy(5000, 1000)).toBe(100);
	});

	it('formatea bytes', () => {
		expect(bytes(512)).toBe('512 B');
		expect(bytes(1536)).toBe('1,5 KB');
		expect(bytes(5 * 1048576)).toBe('5 MB');
		expect(bytes(-1)).toBe('—');
	});

	it('tope redondo del eje', () => {
		expect(niceMax([0.3])).toBe(1);
		expect(niceMax([37])).toBe(50);
		expect(niceMax([120])).toBe(200);
		expect(niceMax([], 60)).toBe(100);
	});

	it('traza la gráfica pegada a la derecha', () => {
		expect(paths([], 10, 100, 20).line).toBe('');
		const p = paths([0, 10], 10, 100, 20, 11);
		expect(p.line).toBe('M90,20L100,0');
		expect(p.area).toBe('M90,20L100,0L100,20L90,20Z');
	});
});
