import { describe, expect, it } from 'vitest';
import { aggregate, inGroup, topImportant } from './imp.ts';
import type { ImpData, ImpEntry } from './types.ts';

const e = (k: string, score: number, sources = ['A'], title = k.toUpperCase()): ImpEntry => ({ k, title, url: `https://x.example/${k}`, sources, score });

const data: ImpData = {
	date: '2026-10-14',
	current: [{ ...e('now', 3), sections: ['es'], first: '2026-10-14T10:00:00Z', time: null }],
	days: [
		{ date: '2025-10-01', items: [e('viejo', 50)] },
		{ date: '2026-09-20', items: [e('a', 4), e('mes', 9)] },
		{ date: '2026-10-12', items: [e('a', 6, ['A', 'B'], 'Titular mejor'), e('b', 8)] },
		{ date: '2026-10-13', items: [e('a', 5, ['C'])] },
		{ date: '2026-10-14', items: [e('hoy1', 7), e('hoy2', 6), e('a', 2)] }
	],
	seen: []
};

describe('topImportant', () => {
	it('da el top del día de los datos', () => {
		expect(topImportant(data, 2).map((i) => i.k)).toEqual(['hoy1', 'hoy2']);
	});

	it('sin histórico de hoy, el top de ahora; sin datos, nada', () => {
		expect(topImportant({ ...data, date: '2026-10-15' }).map((i) => i.k)).toEqual(['now']);
		expect(topImportant(null)).toEqual([]);
	});
});

describe('aggregate', () => {
	it('semana: un tema de varios días suma, se desduplica y se queda con el mejor titular', () => {
		const week = aggregate(data.days, '2026-10-14', 7);
		expect(week.map((t) => [t.k, t.score, t.days])).toEqual([
			['a', 13, 3],
			['b', 8, 1],
			['hoy1', 7, 1],
			['hoy2', 6, 1]
		]);
		expect(week[0]).toMatchObject({ title: 'Titular mejor', url: 'https://x.example/a', sources: ['A', 'B', 'C'], last: '2026-10-14' });
	});

	it('mes y año incluyen días más antiguos', () => {
		const month = aggregate(data.days, '2026-10-14', 30);
		expect(month[0]).toMatchObject({ k: 'a', score: 17, days: 4 });
		expect(month.map((t) => t.k)).toContain('mes');
		expect(month.map((t) => t.k)).not.toContain('viejo');
		expect(aggregate(data.days, '2026-10-14', 365).map((t) => t.k)).not.toContain('viejo');
		expect(aggregate(data.days, '2026-10-14', 400)[0].k).toBe('viejo');
	});

	it('a igual puntuación, más días primero; y respeta el límite', () => {
		const days = [
			{ date: '2026-10-13', items: [e('x', 3)] },
			{ date: '2026-10-14', items: [e('x', 3), e('y', 6)] }
		];
		expect(aggregate(days, '2026-10-14', 7).map((t) => t.k)).toEqual(['x', 'y']);
		expect(aggregate(days, '2026-10-14', 7, 1)).toHaveLength(1);
	});
});

describe('filtro por sección', () => {
	const withSections = (k: string, score: number, sections?: string[]): ImpEntry => ({ ...e(k, score), ...(sections && { sections }) });

	it('al sumar días junta las secciones de cada tema', () => {
		const days = [
			{ date: '2026-10-13', items: [withSections('a', 5, ['es'])] },
			{ date: '2026-10-14', items: [withSections('a', 4, ['eco', 'es'])] }
		];
		expect(aggregate(days, '2026-10-14', 7)[0].sections).toEqual(['es', 'eco']);
	});

	it('se queda con los del grupo, sin repetir y como mucho n; TECH·IA junta las dos secciones', () => {
		const items = [withSections('a', 9, ['es']), withSections('b', 8, ['ai']), withSections('c', 7, ['tech', 'eco']), withSections('a', 6, ['es'])];
		const of = (i: ImpEntry) => i.sections ?? [];
		expect(inGroup(items, 'all', of, 10).map((i) => i.k)).toEqual(['a', 'b', 'c']);
		expect(inGroup(items, 'tech', of, 10).map((i) => i.k)).toEqual(['b', 'c']);
		expect(inGroup(items, 'eco', of, 10).map((i) => i.k)).toEqual(['c']);
		expect(inGroup(items, 'tech', of, 1).map((i) => i.k)).toEqual(['b']);
	});

	it('los temas sin secciones guardadas usan las que dé sectionsOf (las del top de ahora)', () => {
		const live = new Map([['viejo', ['geo']]]);
		expect(inGroup([e('viejo', 3)], 'geo', (i) => i.sections ?? live.get(i.k) ?? [], 10)).toHaveLength(1);
	});
});

