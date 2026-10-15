import { describe, expect, it } from 'vitest';
import { dropPlan, folderOf, folderPath, migrateSpots, withoutSpots } from './desk.ts';
import { DESKTOP, mkdir, seed, trash, TRASH } from './fs.ts';

const base = () => seed([{ id: 'eco', name: 'Economía' }, { id: 'ws', name: 'Wall Street' }], 1);
const idOf = (t: ReturnType<typeof base>, app: string) => Object.values(t).find((n) => n.app === app)!.id;

describe('escritorio con carpetas', () => {
	it('pasa las casillas de las apps a los nodos del escritorio', () => {
		const t = base();
		const spots = migrateSpots({ eco: { col: 2, row: 1 }, geo: { col: 0, row: 0 }, trash: { col: 5, row: 5 } }, t);
		expect(spots).toEqual({ [idOf(t, 'eco')]: { col: 2, row: 1 }, trash: { col: 5, row: 5 } });
	});

	it('quita casillas', () => {
		expect(withoutSpots({ a: { col: 0, row: 0 }, b: { col: 1, row: 0 } }, ['a'])).toEqual({ b: { col: 1, row: 0 } });
	});

	it('decide qué hacer al soltar', () => {
		let t = base();
		const a = mkdir(t, DESKTOP, 'A');
		t = a.tree;
		const b = mkdir(t, a.id!, 'B');
		t = b.tree;
		const eco = idOf(t, 'eco');
		expect(dropPlan(t, [eco], DESKTOP, DESKTOP)).toEqual({ kind: 'desk' });
		expect(dropPlan(t, [eco, TRASH], DESKTOP, a.id)).toEqual({ kind: 'move', ids: [eco], to: a.id });
		expect(dropPlan(t, [eco], DESKTOP, TRASH)).toEqual({ kind: 'trash', ids: [eco] });
		expect(dropPlan(t, [eco], DESKTOP, null)).toEqual({ kind: 'none' });
		expect(dropPlan(t, [eco], DESKTOP, 'nada')).toEqual({ kind: 'none' });
		// Una carpeta no entra en sí misma ni en sus hijas.
		expect(dropPlan(t, [a.id!], DESKTOP, b.id)).toEqual({ kind: 'none' });
		// De una ventana de carpeta al escritorio.
		expect(dropPlan(t, [b.id!], a.id!, DESKTOP)).toEqual({ kind: 'move', ids: [b.id], to: DESKTOP });
		// A su misma carpeta: nada.
		expect(dropPlan(t, [b.id!], a.id!, a.id)).toEqual({ kind: 'none' });
		// Lo que ya está en la papelera no vuelve a tirarse.
		t = trash(t, [eco], 2);
		expect(dropPlan(t, [eco], TRASH, TRASH)).toEqual({ kind: 'none' });
		expect(dropPlan(t, [eco], TRASH, a.id)).toEqual({ kind: 'move', ids: [eco], to: a.id });
	});

	it('guarda la carpeta en la ruta de la ventana', () => {
		expect(folderOf(folderPath('n1'))).toBe('n1');
		expect(folderOf(undefined)).toBe(DESKTOP);
		expect(folderOf('/')).toBe(DESKTOP);
	});
});
