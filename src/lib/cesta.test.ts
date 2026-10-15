import { describe, expect, it } from 'vitest';
import { myInflation, parseBasket, type CpiGroup } from './cesta.ts';

const groups: CpiGroup[] = [
	{ code: 'CP01', label: 'Alimentos', weight: 200, rate: 4 },
	{ code: 'CP04', label: 'Vivienda', weight: 100, rate: -2 },
	{ code: 'CP07', label: 'Transporte', weight: 700, rate: 1 },
	{ code: 'CP10', label: 'Enseñanza', weight: 0, rate: null }
];

describe('myInflation', () => {
	it('con la cesta media, la media ponderada', () => {
		expect(myInflation(groups, {})).toBeCloseTo((200 * 4 - 100 * 2 + 700 * 1) / 1000);
	});
	it('con tus pesos (en %), mezclados con los de la cesta media', () => {
		expect(myInflation(groups, { CP01: 50, CP04: 50, CP07: 0 })).toBeCloseTo(1);
		// Solo cambia alimentos: 50 % tuyo + 10 % vivienda + 70 % transporte de la media.
		expect(myInflation(groups, { CP01: 50 })).toBeCloseTo((50 * 4 - 10 * 2 + 70) / 130);
	});
	it('sin pesos, null', () => {
		expect(myInflation(groups, { CP01: 0, CP04: 0, CP07: 0 })).toBeNull();
	});
});

describe('parseBasket', () => {
	it('solo grupos conocidos y números válidos', () => {
		expect(parseBasket('{"CP01":20,"CP99":5,"CP04":-1,"CP07":"x"}', ['CP01', 'CP04', 'CP07'])).toEqual({ CP01: 20 });
		expect(parseBasket('roto', ['CP01'])).toEqual({});
	});
});
