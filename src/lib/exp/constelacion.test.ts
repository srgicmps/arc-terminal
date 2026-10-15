import { describe, expect, it } from 'vitest';
import type { NewsItem } from '../types.ts';
import { buildGraph, layout, namesIn, neighbours } from './constelacion.ts';

const NOW = Date.parse('2026-10-15T12:00:00Z');
const item = (title: string, h = 1, url = title): NewsItem => ({ title, url, source: 'X', time: new Date(NOW - h * 3_600_000).toISOString(), summary: '' });

describe('constelación', () => {
	it('reconoce valores, líderes, bancos, países y temas', () => {
		const kinds = namesIn('Lagarde y el BCE avisan a China por los aranceles mientras Nvidia sube').map((n) => `${n.kind}:${n.label}`);
		expect(kinds).toEqual(expect.arrayContaining(['banco:BCE', 'pais:China', 'tema:Aranceles', 'valor:NVIDIA']));
		expect(kinds.some((k) => k.startsWith('lider:'))).toBe(true);
	});

	it('une lo que sale junto, quita lo suelto y lo viejo', () => {
		const g = buildGraph(
			[
				item('China y Estados Unidos negocian los aranceles', 1, 'a'),
				item('Aranceles: China responde a Estados Unidos', 2, 'b'),
				item('China sube los aranceles', 3, 'c'),
				item('Japón celebra elecciones', 4, 'd'),
				item('China y Estados Unidos, otra vez', 100, 'e')
			],
			NOW
		);
		const ids = g.nodes.map((n) => n.id).sort();
		expect(ids).toEqual(['country:China', 'country:Estados Unidos', 'tema:aranceles'].sort());
		const china = g.nodes.find((n) => n.id === 'country:China')!;
		expect(china.n).toBe(3);
		expect(china.news[0].url).toBe('a');
		expect(neighbours('tema:aranceles', g.edges)).toEqual([
			{ id: 'country:China', w: 3 },
			{ id: 'country:Estados Unidos', w: 2 }
		]);
		expect(g.items).toBe(4);
	});

	it('la disposición es estable, cabe en el cuadro y separa los nodos', () => {
		const nodes = ['a', 'b', 'c', 'd'].map((id) => ({ id }));
		const edges = [{ a: 'a', b: 'b', w: 3 }, { a: 'c', b: 'd', w: 1 }];
		const one = layout(nodes, edges);
		expect(layout(nodes, edges)).toEqual(one);
		for (const p of one) {
			expect(p.x).toBeGreaterThanOrEqual(0.05);
			expect(p.x).toBeLessThanOrEqual(0.95);
		}
		const d = (i: number, j: number) => Math.hypot(one[i].x - one[j].x, one[i].y - one[j].y);
		expect(d(0, 1)).toBeGreaterThan(0.01);
		expect(d(0, 2)).toBeGreaterThan(d(0, 1) * 0.5);
	});
});
