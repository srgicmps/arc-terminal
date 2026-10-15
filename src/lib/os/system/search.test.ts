import { describe, expect, it } from 'vitest';
import { recentHits, searchAll } from './search.ts';

const kinds = (q: string) => searchAll(q).map((h) => h.kind);

describe('buscador universal', () => {
	it('sin texto, las apps recientes que siguen instaladas, de la más reciente', () => {
		const hits = recentHits(['reloj', 'no-existe', 'eco'], undefined, 6);
		expect(hits.map((h) => h.action)).toEqual([{ app: 'reloj' }, { app: 'eco' }]);
		expect(recentHits(['reloj', 'eco'], undefined, 1)).toHaveLength(1);
	});
	it('nada sin texto', () => {
		expect(searchAll('  ')).toEqual([]);
	});

	it('una app por su código, la primera', () => {
		const [first] = searchAll('eco');
		expect(first.kind).toBe('App');
		expect(first.action).toEqual({ app: 'eco' });
	});

	it('valores por nombre o alias', () => {
		const hit = searchAll('google').find((h) => h.kind === 'Valor');
		expect(hit?.action).toEqual({ path: '/s?sym=GOOGL' });
	});

	it('lo que entiende la barra, con su ruta', () => {
		const hit = searchAll('NEWS inflación').find((h) => h.kind === 'Comando');
		expect(hit?.action).toEqual({ path: '/news?q=inflaci%C3%B3n' });
	});

	it('países, líderes y ajustes', () => {
		expect(searchAll('alemania').find((h) => h.kind === 'País')?.action).toEqual({ path: '/pais?c=DE' });
		expect(kinds('lagarde')).toContain('Líder');
		expect(searchAll('bloquear')[0].action).toEqual({ sys: 'lock' });
		expect(kinds('fondo de pantalla')).toContain('Ajuste');
	});

	it('un valor desconocido abre su ficha', () => {
		expect(searchAll('TSM').at(-1)?.action).toEqual({ path: '/s?sym=TSM' });
	});

	it('no repite y respeta el tope', () => {
		const list = searchAll('a', undefined, 5);
		expect(list.length).toBeLessThanOrEqual(5);
		expect(new Set(list.map((h) => h.id)).size).toBe(list.length);
	});
});
