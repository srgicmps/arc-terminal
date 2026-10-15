import { describe, expect, it } from 'vitest';
import { HOLIDAY_COUNTRIES, holidaysWorld, parseHolidays } from '../sources/holidays-world.ts';
import { mockFetch } from './mock.ts';

describe('holidays-world (F6)', () => {
	it('parseHolidays: con sus regiones y sin los días que no son de fiesta', () => {
		expect(
			parseHolidays([
				{ date: '2026-12-08', localName: 'Inmaculada', global: true, counties: null, types: ['Public'] },
				{ date: '2026-11-09', localName: 'Almudena', global: false, counties: ['ES-MD'], types: ['Public'] },
				{ date: '2026-12-24', localName: 'Bank Day', global: true, types: ['Bank'] }
			])
		).toEqual([
			{ date: '2026-12-08', name: 'Inmaculada' },
			{ date: '2026-11-09', name: 'Almudena', counties: ['ES-MD'] }
		]);
	});

	it('si un país falla se queda el de la copia anterior; sin España, error', async () => {
		mockFetch((url) => {
			if (url.endsWith('/FR')) return undefined; // 404
			return [{ date: '2026-12-25', localName: 'Navidad', global: true, types: ['Public'] }];
		});
		const prev = { countries: { FR: [{ date: '2026-07-14', name: 'Fête nationale' }] } };
		const { countries } = await holidaysWorld.fetch(prev as never, undefined as never);
		expect(Object.keys(countries)).toHaveLength(HOLIDAY_COUNTRIES.length);
		expect(countries.FR[0].name).toBe('Fête nationale');
		mockFetch(() => []);
		await expect(holidaysWorld.fetch(undefined as never, undefined as never)).rejects.toThrow('España');
	});
});
