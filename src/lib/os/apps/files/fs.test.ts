import { describe, expect, it } from 'vitest';
import { addFolder, addLink, childrenOf, emptyFs, emptyTrash, freeName, move, pathTo, purge, readFs, rename, restore, ROOT, trash, trashed } from './fs.ts';

describe('Archivos: sistema de archivos virtual', () => {
	it('crea carpetas sin repetir nombre y accesos directos', () => {
		const s = emptyFs();
		const a = addFolder(s, ROOT)!;
		const b = addFolder(s, ROOT)!;
		expect([a.name, b.name]).toEqual(['Carpeta nueva', 'Carpeta nueva 2']);
		addLink(s, a.id, 'app:eco');
		expect(childrenOf(s, a.id).links).toHaveLength(1);
		expect(addLink(s, 'nada', 'app:eco')).toBeNull();
		expect(freeName(s, ROOT, 'carpeta NUEVA')).toBe('carpeta NUEVA 3');
	});

	it('renombra y mueve sin meter una carpeta dentro de sí misma', () => {
		const s = emptyFs();
		const a = addFolder(s, ROOT, 'Trabajo')!;
		const b = addFolder(s, a.id, 'Mercados')!;
		expect(rename(s, b.id, '  Bolsa / EE. UU. ')).toBe(true);
		expect(b.name).toBe('Bolsa   EE. UU.');
		expect(move(s, a.id, b.id)).toBe(false);
		expect(pathTo(s, b.id).map((f) => f.name)).toEqual(['Trabajo', 'Bolsa   EE. UU.']);
		const l = addLink(s, ROOT, 'tick:NVDA')!;
		expect(move(s, l.id, b.id)).toBe(true);
	});

	it('papelera: tirar, restaurar y vaciar con lo de dentro', () => {
		const s = emptyFs();
		const a = addFolder(s, ROOT, 'A')!;
		const l = addLink(s, a.id, 'app:eco')!;
		trash(s, a.id, 5);
		expect(childrenOf(s, ROOT).folders).toHaveLength(0);
		expect(trashed(s).map((e) => e.id)).toEqual([a.id]);
		restore(s, a.id);
		expect(childrenOf(s, ROOT).folders).toHaveLength(1);
		trash(s, a.id);
		emptyTrash(s);
		expect(s.folders).toHaveLength(0);
		expect(s.links.find((x) => x.id === l.id)).toBeUndefined();
	});

	it('restaurar algo cuya carpeta ya no está lo deja en Inicio', () => {
		const s = emptyFs();
		const a = addFolder(s, ROOT, 'A')!;
		const l = addLink(s, a.id, 'app:eco')!;
		trash(s, l.id);
		purge(s, a.id);
		expect(s.links).toHaveLength(0);
		const t = readFs({ v: 1, folders: [], links: [{ id: 'x', target: 'app:eco', parent: 'gone' }], seq: 2 });
		expect(t.links[0].parent).toBe(ROOT);
		expect(readFs(null)).toEqual(emptyFs());
	});
});
