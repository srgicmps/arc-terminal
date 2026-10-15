import { describe, expect, it } from 'vitest';
import { ecstRows, sortRows } from './ecst.ts';
import type { ImfCountry, Series } from './types.ts';

const country = (code: string, name: string, gdp: number | null): ImfCountry => ({
	code,
	name,
	gdp,
	cpi: 2,
	unemployment: 5,
	debt: 100,
	balance: -3
});
const series = (id: string, v: number): Series => ({ id, label: id, unit: '%', points: [{ t: '2026-09', v: v - 1 }, { t: '2026-10', v }], source: 'x' });
const curve = (ten: number) => ({ tenors: ['2A', '10A'], days: [{ date: '2026-10-13', values: [1, ten] }] });

describe('ecst', () => {
	it('junta el FMI con el tipo del BIS (el del BCE para los del euro) y el bono a 10 años', () => {
		const rows = ecstRows(
			[country('USA', 'EE. UU.', 1.8), country('ESP', 'España', 2.4), country('JPN', 'Japón', 0.5), country('ARG', 'Argentina', 4)],
			[series('policy-us', 4.25), series('policy-xm', 2), series('policy-jp', 0.75), series('bond10-es', 3.2)],
			{ us: curve(4.1), jp: curve(1.7) }
		);
		expect(rows.map((r) => [r.code, r.rate, r.bond])).toEqual([
			['USA', 4.25, 4.1],
			['ESP', 2, 3.2],
			['JPN', 0.75, 1.7],
			['ARG', null, null]
		]);
	});

	it('ordena por cualquier columna y deja los vacíos al final en los dos sentidos', () => {
		const rows = ecstRows([country('A', 'Brasil', 2), country('B', 'Alemania', null), country('C', 'China', 5)], [], {});
		expect(sortRows(rows, 'gdp', 'desc').map((r) => r.code)).toEqual(['C', 'A', 'B']);
		expect(sortRows(rows, 'gdp', 'asc').map((r) => r.code)).toEqual(['A', 'C', 'B']);
		expect(sortRows(rows, 'name', 'asc').map((r) => r.name)).toEqual(['Alemania', 'Brasil', 'China']);
	});
});
