import { describe, expect, it } from 'vitest';
import { ESSENTIAL } from './simple.ts';
import { EXTRA, explain, unexplained } from './explain.ts';

describe('explain', () => {
	it('junta el glosario con el porqué y el cómo', () => {
		const e = explain('Euríbor a 12 meses');
		expect(e?.term).toBe('Euríbor');
		expect(e?.why).toMatch(/hipoteca/);
		expect(e?.how).toBeTruthy();
	});
	it('lo concreto gana a lo general', () => {
		expect(explain('Tu hipoteca')?.id).toBe('my-mortgage');
		expect(explain('Mapa de calor')?.id).toBe('heatmap');
		expect(explain('Mercados de predicción')?.id).toBe('predictions');
		expect(explain('Primas de riesgo')?.id).toBe('premiums');
	});
	it('no inventa: lo desconocido no tiene explicación', () => {
		expect(explain('Problema del día')).toBeUndefined();
		expect(explain('')).toBeUndefined();
	});
	it('frases cortas: de una a tres por campo', () => {
		for (const e of EXTRA) for (const t of [e.def, e.why, e.how]) expect(t.split(/[.!?](\s|$)/).filter((x) => x?.trim()).length).toBeLessThanOrEqual(3);
	});
	it('los términos clave del glosario tienen porqué y cómo', () => {
		const left = unexplained();
		for (const id of ['cpi', 'euribor', 'premium', 'vix', 'yield-curve', 'gdp', 'unemployment']) expect(left).not.toContain(id);
	});
	it('los paneles esenciales de ECO y WS se explican', () => {
		for (const route of ['/eco', '/ws']) for (const title of ESSENTIAL[route]) expect(explain(title), `${route} ${title}`).toBeDefined();
	});
});
