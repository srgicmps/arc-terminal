import { describe, expect, it } from 'vitest';
import { figures, FIGURES } from './figures.ts';
import type { Series } from '../types.ts';

const s = (id: string, vs: number[]): Series => ({ id, label: id, unit: '%', source: 'X', points: vs.map((v, i) => ({ t: `2026-10-0${i + 1}`, v })) });

describe('cifras del día', () => {
	const map = new Map([s('euribor-12m', [2.5, 2.45]), s('bond10-es', [3.2, 3.1]), s('bond10-de', [2.6, 2.6])].map((x) => [x.id, x]));
	const get = (id: string) => map.get(id);

	it('saca el último dato y el cambio, y se salta las que no tienen serie', () => {
		const out = figures(get);
		const eur = out.find((f) => f.id === 'euribor')!;
		expect(eur.text).toBe('2,450 %');
		expect(eur.changeText).toBe('−0,050');
		expect(out.find((f) => f.id === 'vix')).toBeUndefined();
	});

	it('calcula la prima de riesgo en puntos básicos', () => {
		const p = figures(get).find((f) => f.id === 'prima')!;
		expect(p.value).toBeCloseTo(50);
		expect(p.changeText).toBe('−10');
	});

	it('todas tienen explicación y no se repiten', () => {
		expect(new Set(FIGURES.map((f) => f.id)).size).toBe(FIGURES.length);
		for (const f of FIGURES) expect(f.explain.length).toBeGreaterThan(20);
	});
});
