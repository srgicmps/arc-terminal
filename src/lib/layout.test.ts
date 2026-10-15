import { describe, expect, it } from 'vitest';
import { defaults, packGrid, hide, move, place, reconcile, setSpan, show, type ModuleDef } from './layout.ts';

const MODS: ModuleDef[] = [
	{ id: 'a', title: 'A' },
	{ id: 'b', title: 'B', span: 2 },
	{ id: 'c', title: 'C' },
	{ id: 'd', title: 'D' }
];

describe('reconcile', () => {
	it('sin nada guardado (o roto), el diseño de fábrica', () => {
		const base = { order: ['a', 'b', 'c', 'd'], hidden: [], span: { a: 1, b: 2, c: 1, d: 1 } };
		expect(reconcile(null, MODS)).toEqual(base);
		expect(reconcile('basura', MODS)).toEqual(base);
		expect(reconcile({ order: 3, hidden: 'x', span: [] }, MODS)).toEqual(base);
	});

	it('olvida los módulos que ya no existen y añade al final los nuevos', () => {
		const l = reconcile({ order: ['c', 'zz', 'a'], hidden: ['zz', 'a'], span: { c: 3, zz: 2, a: 7 } }, MODS);
		expect(l.order).toEqual(['c', 'a', 'b', 'd']);
		expect(l.hidden).toEqual(['a']);
		expect(l.span).toEqual({ a: 1, b: 2, c: 3, d: 1 });
	});
});

describe('cambios', () => {
	const base = defaults(MODS);

	it('mueve entre los visibles, saltándose los ocultos', () => {
		const l = hide(base, 'b');
		expect(move(l, 'c', -1).order).toEqual(['c', 'a', 'b', 'd']);
		expect(move(l, 'a', 1).order).toEqual(['b', 'c', 'a', 'd']);
		expect(move(base, 'a', -1)).toBe(base);
		expect(move(base, 'd', 1)).toBe(base);
	});

	it('suelta un panel antes o después de otro', () => {
		expect(place(base, 'd', 'a').order).toEqual(['d', 'a', 'b', 'c']);
		expect(place(base, 'a', 'c', true).order).toEqual(['b', 'c', 'a', 'd']);
		expect(place(base, 'a', 'a')).toBe(base);
		expect(place(base, 'a', 'zz')).toBe(base);
	});

	it('oculta, muestra y cambia el ancho sin tocar el original', () => {
		const l = setSpan(hide(hide(base, 'c'), 'c'), 'a', 3);
		expect(l.hidden).toEqual(['c']);
		expect(l.span.a).toBe(3);
		expect(show(l, 'c').hidden).toEqual([]);
		expect(base.hidden).toEqual([]);
		expect(base.span.a).toBe(1);
	});
});

describe('packGrid', () => {
	it('pocos paneles llenan el ancho', () => {
		expect(packGrid([1, 1], 3)).toEqual({ cols: 2, spans: [1, 1] });
		expect(packGrid([1, 2], 3)).toEqual({ cols: 3, spans: [1, 2] });
		expect(packGrid([1], 3)).toEqual({ cols: 1, spans: [1] });
	});

	it('sin huecos al final de fila', () => {
		expect(packGrid([1, 1, 1, 1], 3)).toEqual({ cols: 3, spans: [1, 1, 1, 3] });
		expect(packGrid([1, 1, 2, 1], 3)).toEqual({ cols: 3, spans: [1, 2, 2, 1] });
		expect(packGrid([3, 1], 2)).toEqual({ cols: 2, spans: [2, 2] });
		expect(packGrid([], 3)).toEqual({ cols: 1, spans: [] });
	});
});
