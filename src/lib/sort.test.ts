import { describe, expect, it } from 'vitest';
import { sortBy } from './sort.ts';

describe('ordenar tablas', () => {
	const rows = [
		{ n: 'Brasil', v: 2 },
		{ n: 'Álava', v: null },
		{ n: 'China', v: 5 },
		{ n: 'alemania', v: Number.NaN }
	];

	it('ordena números en los dos sentidos con los vacíos al final', () => {
		expect(sortBy(rows, (r) => r.v, 'desc').map((r) => r.n)).toEqual(['China', 'Brasil', 'Álava', 'alemania']);
		expect(sortBy(rows, (r) => r.v, 'asc').map((r) => r.n)).toEqual(['Brasil', 'China', 'Álava', 'alemania']);
	});

	it('ordena textos en orden alfabético español, sin distinguir acentos ni mayúsculas', () => {
		expect(sortBy(rows, (r) => r.n, 'asc').map((r) => r.n)).toEqual(['Álava', 'alemania', 'Brasil', 'China']);
	});

	it('no cambia la lista original', () => {
		const copy = [...rows];
		sortBy(rows, (r) => r.v, 'asc');
		expect(rows).toEqual(copy);
	});
});
