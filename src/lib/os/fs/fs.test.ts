import { describe, expect, it } from 'vitest';
import { add, DESKTOP, emptyTrash, list, mkdir, move, parseTree, path, purge, rename, restore, seed, trash, TRASH } from './fs.ts';

describe('archivos de Arc OS', () => {
	const base = () => seed([{ id: 'eco', name: 'Economía' }, { id: 'ws', name: 'Wall Street' }], 1);

	it('siembra el escritorio con las apps', () => {
		const t = base();
		expect(list(t, DESKTOP).map((n) => n.app)).toEqual(['eco', 'ws']);
	});

	it('crea carpetas con nombre libre y las pone primero', () => {
		let t = base();
		const a = mkdir(t, DESKTOP);
		t = a.tree;
		const b = mkdir(t, DESKTOP);
		t = b.tree;
		expect(t[b.id!].name).toBe('Carpeta nueva 2');
		expect(list(t, DESKTOP)[0].kind).toBe('folder');
	});

	it('renombra sin repetir nombre en la carpeta', () => {
		let t = base();
		const { tree, id } = mkdir(t, DESKTOP, 'Mercados');
		t = rename(tree, id!, '  Economía  ');
		expect(t[id!].name).toBe('Economía 2');
		expect(rename(t, id!, '   ')).toBe(t);
	});

	it('mueve dentro y fuera, sin meter una carpeta en sí misma', () => {
		let t = base();
		const f = mkdir(t, DESKTOP, 'A');
		const g = mkdir(f.tree, f.id!, 'B');
		t = g.tree;
		const eco = list(t, DESKTOP).find((n) => n.app === 'eco')!.id;
		t = move(t, [eco], g.id!);
		expect(path(t, eco).map((n) => n.name)).toEqual(['A', 'B', 'Economía']);
		expect(move(t, [f.id!], g.id!)[f.id!].parent).toBe(DESKTOP);
		t = move(t, [eco], DESKTOP);
		expect(t[eco].parent).toBe(DESKTOP);
	});

	it('papelera: tira, recupera a su sitio y vacía con lo de dentro', () => {
		let t = base();
		const f = mkdir(t, DESKTOP, 'A');
		t = f.tree;
		const eco = list(t, DESKTOP).find((n) => n.app === 'eco')!.id;
		t = move(t, [eco], f.id!);
		t = trash(t, [eco]);
		expect(t[eco].parent).toBe(TRASH);
		t = restore(t, [eco]);
		expect(t[eco].parent).toBe(f.id);
		t = trash(t, [f.id!]);
		t = emptyTrash(t);
		expect(t[f.id!]).toBeUndefined();
		expect(t[eco]).toBeUndefined();
	});

	it('recupera al escritorio si su carpeta ya no está', () => {
		let t = base();
		const f = mkdir(t, DESKTOP, 'A');
		t = f.tree;
		const eco = list(t, DESKTOP).find((n) => n.app === 'eco')!.id;
		t = move(t, [eco], f.id!);
		t = trash(t, [eco]);
		t = purge(t, [f.id!]);
		expect(restore(t, [eco])[eco].parent).toBe(DESKTOP);
	});

	it('no añade en una carpeta que no existe', () => {
		expect(add({}, { kind: 'folder', name: 'x', parent: 'nope' }).id).toBeNull();
	});

	it('valida lo guardado y rescata lo huérfano o en ciclo', () => {
		expect(parseTree(null)).toBeNull();
		expect(parseTree('{')).toBeNull();
		const t = parseTree(
			JSON.stringify({
				a: { kind: 'folder', name: 'A', parent: 'b', at: 1 },
				b: { kind: 'folder', name: 'B', parent: 'a', at: 1 },
				c: { kind: 'app', name: 'Eco', parent: 'zzz', app: 'eco', at: 1 },
				d: { kind: 'app', name: 'Sin app', parent: DESKTOP },
				e: { kind: 'raro', name: 'x', parent: DESKTOP }
			})
		)!;
		expect(Object.keys(t).sort()).toEqual(['a', 'b', 'c']);
		expect(t.c.parent).toBe(DESKTOP);
		expect([t.a.parent, t.b.parent]).toContain(DESKTOP);
	});
});
