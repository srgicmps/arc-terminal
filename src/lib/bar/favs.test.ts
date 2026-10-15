// Favoritos de la barra: «fav ECO TIPOS», «1», «fav -1».
import { describe, expect, it } from 'vitest';
import { addFav, favOptions, FAVS_KEY, FAVS_MAX, parseFav, readFavs, removeFav, writeFavs } from './favs.ts';

describe('favoritos', () => {
	it('entiende fav, unfav y los números', () => {
		expect(parseFav('fav ECO TIPOS')).toEqual({ kind: 'add', entry: 'ECO TIPOS' });
		expect(parseFav('FAV')).toEqual({ kind: 'list' });
		expect(parseFav('fav -2')).toEqual({ kind: 'remove', n: 2 });
		expect(parseFav('unfav 3')).toEqual({ kind: 'remove', n: 3 });
		expect(parseFav('2')).toEqual({ kind: 'open', n: 2 });
		expect(parseFav('10')).toBeNull();
		expect(parseFav('FUEL')).toBeNull();
		expect(parseFav('favela')).toBeNull();
	});

	it('añade sin repetir, con un máximo, y quita', () => {
		let { list, n } = addFav([], 'ECO TIPOS');
		expect([list, n]).toEqual([['ECO TIPOS'], 1]);
		expect(addFav(list, 'eco tipos')).toEqual({ list, n: 1 });
		list = Array.from({ length: FAVS_MAX }, (_, i) => `X${i}`);
		expect(addFav(list, 'WS').n).toBe(0);
		expect(removeFav(['A', 'B', 'C'], 2)).toEqual(['A', 'C']);
	});

	it('sugiere qué abre cada número', () => {
		expect(favOptions('1', ['ECO TIPOS'])).toEqual([{ code: '1', desc: 'ECO TIPOS', kind: 'Favorito', run: 'ECO TIPOS' }]);
		expect(favOptions('2', ['ECO TIPOS'])).toBeNull();
		expect(favOptions('fav', ['A', 'B'])?.map((o) => o.code)).toEqual(['1', '2']);
		expect(favOptions('fav WS', ['A'])?.[0].desc).toBe('Guardar «WS» como favorito 2');
	});

	it('lee y escribe sin romperse', () => {
		const data = new Map<string, string>();
		const store = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
		writeFavs(['ECO'], () => store);
		expect(data.get(FAVS_KEY)).toBe('["ECO"]');
		expect(readFavs(() => store)).toEqual(['ECO']);
		expect(readFavs(() => undefined)).toEqual([]);
	});
});
