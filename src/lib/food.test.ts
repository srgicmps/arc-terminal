import { describe, expect, it } from 'vitest';
import { foodCountry, peopleRange, vsYearText } from './food.ts';

describe('food', () => {
	it('países en español, con tilde', () => {
		expect(foodCountry('ML', 'Mali')).toBe('Malí');
	});
	it('horquillas de personas legibles', () => {
		expect(peopleRange(8_000_000, 8_999_999)).toBe('8–9 M');
		expect(peopleRange(10_000_000, 10_999_999)).toBe('10–11 M');
		expect(peopleRange(500_000, 999_999)).toBe('500–1000 mil');
		expect(peopleRange(2_500_000, 4_999_999)).toBe('2,5–5 M');
		expect(peopleRange(3_000_000, 3_000_000)).toBe('3 M');
	});

	it('comparación con hace un año', () => {
		expect(vsYearText('Higher')).toBe('más que hace un año');
		expect(vsYearText(null)).toBeNull();
	});
});
