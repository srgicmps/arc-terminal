import { describe, expect, it } from 'vitest';
import { byMove, maxMove } from './predictions.ts';
import type { Prediction } from './types.ts';

const ev = (id: string, ...d: (number | undefined)[]): Prediction => ({
	id,
	title: id,
	url: '',
	volume24h: 0,
	endDate: '',
	outcomes: d.map((x, i) => ({ label: String(i), p: 0.5, ...(x === undefined ? {} : { d: x }) }))
});

describe('predictions', () => {
	it('maxMove: el mayor cambio en valor absoluto; 0 sin dato', () => {
		expect(maxMove(ev('a', 0.02, -0.07))).toBe(0.07);
		expect(maxMove(ev('b', undefined))).toBe(0);
	});

	it('byMove: lo que más se mueve arriba; a igualdad, el orden de llegada', () => {
		const list = [ev('quieto'), ev('poco', 0.01), ev('mucho', -0.12), ev('quieto2')];
		expect(byMove(list).map((e) => e.id)).toEqual(['mucho', 'poco', 'quieto', 'quieto2']);
		expect(list.map((e) => e.id)).toEqual(['quieto', 'poco', 'mucho', 'quieto2']);
	});
});
