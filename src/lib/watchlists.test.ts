import { describe, expect, it } from 'vitest';
import { addList, FIRST_NAME, MAX_LISTS, readLists, removeList } from './watchlists.ts';

describe('varias listas en MIS', () => {
	it('pasa la lista de siempre a la primera, «Mi lista», si aún no hay listas', () => {
		expect(readLists(null, '["NVDA","SAN"]')).toEqual({ active: 0, lists: [{ name: FIRST_NAME, codes: ['NVDA', 'SAN'] }] });
		expect(readLists(null, null)).toEqual({ active: 0, lists: [{ name: FIRST_NAME, codes: [] }] });
		expect(readLists('estropeado', 'también')).toEqual({ active: 0, lists: [{ name: FIRST_NAME, codes: [] }] });
	});

	it('lee las listas guardadas y corrige lo que no vale', () => {
		const saved = JSON.stringify({ active: 1, lists: [{ name: 'IA', codes: ['NVDA', 3] }, { name: ' ', codes: 'x' }] });
		expect(readLists(saved, '["OTRA"]')).toEqual({
			active: 1,
			lists: [
				{ name: 'IA', codes: ['NVDA'] },
				{ name: FIRST_NAME, codes: [] }
			]
		});
		expect(readLists(JSON.stringify({ active: 9, lists: [{ name: 'A', codes: [] }] }), null).active).toBe(0);
	});

	it('añade listas sin repetir nombre ni pasar del tope, y la nueva queda activa', () => {
		let s = readLists(null, '[]');
		s = addList(s, '  Defensa ');
		expect(s).toEqual({ active: 1, lists: [{ name: FIRST_NAME, codes: [] }, { name: 'Defensa', codes: [] }] });
		expect(addList(s, 'defensa')).toBe(s);
		expect(addList(s, '   ')).toBe(s);
		for (let i = 0; i < 20; i++) s = addList(s, `L${i}`);
		expect(s.lists).toHaveLength(MAX_LISTS);
	});

	it('quita una lista, nunca la última, y deja activa la de al lado', () => {
		const s = { active: 2, lists: ['A', 'B', 'C'].map((name) => ({ name, codes: [] })) };
		expect(removeList(s, 2)).toMatchObject({ active: 1, lists: [{ name: 'A' }, { name: 'B' }] });
		expect(removeList(s, 0)).toMatchObject({ active: 0, lists: [{ name: 'B' }, { name: 'C' }] });
		const one = { active: 0, lists: [{ name: 'A', codes: [] }] };
		expect(removeList(one, 0)).toBe(one);
	});
});
