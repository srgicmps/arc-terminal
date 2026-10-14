import { describe, expect, it } from 'vitest';
import { advisoryCountry, advisoryFor, levelCounts, recentChanges } from './advisories.ts';
import { countryByName } from './countries.ts';
import type { TravelAdvisory } from './types.ts';

const a = (name: string, level: TravelAdvisory['level'], updated: string, extra: Partial<TravelAdvisory> = {}): TravelAdvisory => ({
	name,
	level,
	title: `${name} - Level ${level}`,
	url: '',
	updated,
	...extra
});

const items = [
	a('Ukraine', 4, '2026-08-28T00:00:00.000Z'),
	a('Iceland', 1, '2026-10-10T00:00:00.000Z'),
	a('Niger', 4, '2026-10-01T00:00:00.000Z'),
	a('Spain', 2, '2026-06-01T00:00:00.000Z', { prevLevel: 1, changedAt: '2026-10-12T00:00:00.000Z' })
];
const now = Date.parse('2026-10-14T12:00:00Z');

describe('advisories', () => {
	it('casa el país por nombre exacto: Niger no es Nigeria', () => {
		expect(advisoryCountry({ name: 'Ukraine' })?.code).toBe('UA');
		expect(advisoryCountry({ name: 'Niger' })).toBeUndefined();
		expect(countryByName('South Korea')?.code).toBe('KR');
		expect(advisoryFor(items, 'ES')?.level).toBe(2);
		expect(advisoryFor(items, 'NG')).toBeUndefined();
	});

	it('recuento por nivel', () => {
		expect(levelCounts(items)).toEqual([1, 1, 0, 2]);
	});

	it('cambios de los últimos 30 días: primero los de nivel, luego los actualizados', () => {
		expect(recentChanges(items, now).map((i) => i.name)).toEqual(['Spain', 'Iceland', 'Niger']);
		expect(recentChanges(items, now, 30, 2).map((i) => i.name)).toEqual(['Spain', 'Iceland']);
	});
});
