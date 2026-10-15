import { describe, expect, it } from 'vitest';
import { changeSentence, zenCards } from './zen.ts';
import type { Figure } from './figures.ts';

const fig = (id: string, change: number | null): Figure =>
	({ id, series: id, label: id, unit: '%', decimals: 2, explain: 'x', section: 'eco', view: '/eco', value: 1, change, t: '2026-09', source: 'X', text: '1 %', changeText: null }) as Figure;

describe('Zen', () => {
	it('explica el cambio con palabras', () => {
		expect(changeSentence({ change: -0.05, decimals: 2, unit: '%', t: '2026-09' })).toBe('Ha bajado 0,05 puntos desde el dato anterior. Dato de sep 26.');
		expect(changeSentence({ change: 12, decimals: 0, unit: 'pb', t: '2026-10-14' })).toBe('Ha subido 12 puntos básicos desde el dato anterior. Dato de 14 oct.');
		expect(changeSentence({ change: 0.001, decimals: 2, unit: '%', t: '2026-09' })).toMatch(/^Sin cambios/);
		expect(changeSentence({ change: null, decimals: 2, unit: '%', t: '2026-09' })).toBe('Dato de sep 26.');
	});

	it('alterna noticias y cifras, y añade un término del glosario si lo hay', () => {
		const cards = zenCards(
			[
				{ k: 'a', title: 'Sube el euríbor', url: 'u', sources: ['X'] },
				{ k: 'b', title: 'Otra cosa', url: 'u', sources: ['X'] },
				{ k: 'c', title: 'Y otra', url: 'u', sources: ['X'] }
			],
			[fig('x', 1)]
		);
		expect(cards.map((c) => c.key)).toEqual(['n-a', 'f-x', 'n-b', 'n-c']);
		expect(cards[0].kind === 'news' && cards[0].term?.term).toBe('Euríbor');
	});
});
