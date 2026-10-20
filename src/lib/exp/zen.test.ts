import { describe, expect, it } from 'vitest';
import { cardIndex, changeSentence, zenCards } from './zen.ts';
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

	it('con datos nuevos sigues en la misma tarjeta, aunque cambie el orden o entre una delante', () => {
		const deck = (...keys: string[]) => keys.map((key) => ({ key }));
		// Leías la 3.ª (n-c); llega una nueva delante: sigue siendo n-c, ahora la 4.ª.
		expect(cardIndex(deck('n-z', 'n-a', 'f-x', 'n-c'), 'n-c', 2)).toBe(3);
		// Otro orden.
		expect(cardIndex(deck('n-c', 'n-a', 'f-x'), 'n-c', 2)).toBe(0);
		// Ya no está: la de su sitio, dentro de la baraja.
		expect(cardIndex(deck('n-a', 'f-x', 'n-d'), 'n-c', 2)).toBe(2);
		expect(cardIndex(deck('n-a'), 'n-c', 2)).toBe(0);
		// Al entrar (sin clave aún), la primera.
		expect(cardIndex(deck('n-a', 'f-x'), null, 0)).toBe(0);
		expect(cardIndex([], null, 0)).toBe(0);
	});
});
