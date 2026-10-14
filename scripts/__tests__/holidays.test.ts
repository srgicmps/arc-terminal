import { describe, expect, it } from 'vitest';
import { holidays } from '../sources/holidays.ts';
import { mockFetch } from './mock.ts';

describe('holidays', () => {
	it('se queda con los nacionales y los de Baleares, de este año y del siguiente', async () => {
		const year = new Date().getUTCFullYear();
		const fetch = mockFetch((url) =>
			url.endsWith(`/${year}/ES`)
				? [
						{ date: `${year}-12-08`, localName: 'Inmaculada Concepción', global: true, counties: null },
						{ date: `${year}-03-01`, localName: 'Día de las Illes Balears', global: false, counties: ['ES-IB'] },
						{ date: `${year}-04-23`, localName: 'San Jorge', global: false, counties: ['ES-AR'] }
					]
				: [{ date: `${year + 1}-01-01`, localName: 'Año Nuevo', global: true, counties: null }]
		);
		const { items } = await holidays.fetch(undefined);
		expect(items).toEqual([
			{ date: `${year}-03-01`, name: 'Día de las Illes Balears', scope: 'IB' },
			{ date: `${year}-12-08`, name: 'Inmaculada Concepción', scope: 'ES' },
			{ date: `${year + 1}-01-01`, name: 'Año Nuevo', scope: 'ES' }
		]);
		expect(fetch).toHaveBeenCalledTimes(2);
	});

	it('falla si no llega ningún festivo', async () => {
		mockFetch(() => []);
		await expect(holidays.fetch(undefined)).rejects.toThrow('Nager.Date no devuelve festivos');
	});
});
