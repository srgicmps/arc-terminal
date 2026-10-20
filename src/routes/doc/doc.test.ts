// DOC copia trozos del código de otras vistas buscando un marcador (un trozo de texto).
// Si alguien cambia esa línea, el fragmento sale null y DOC oculta el ejemplo sin avisar.
// Este test lo convierte en un rojo en el mismo PR que lo rompe, y dice qué fragmento falta:
// basta con poner en +page.server.ts un marcador que vuelva a estar en el archivo.
import { describe, expect, it } from 'vitest';
import { load } from './+page.server.ts';

type LoadEvent = Parameters<typeof load>[0];

describe('DOC', () => {
	it('encuentra todos los fragmentos de código que enseña', async () => {
		const data = (await load({} as LoadEvent)) as { snippets: Record<string, unknown> };
		const missing = Object.entries(data.snippets)
			.filter(([, excerpt]) => excerpt === null)
			.map(([name]) => name);
		expect(missing).toEqual([]);
	});
});
