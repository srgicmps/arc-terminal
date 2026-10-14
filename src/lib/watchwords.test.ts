import { describe, expect, it } from 'vitest';
import type { BoeData } from './types.ts';
import { countWatchedToday, highlight, matches, watched } from './watchwords.ts';

const item = (id: string, title: string, dept = 'MINISTERIO', epigraph = '') => ({ id, title, dept, epigraph, html: '', pdf: '' });
const boe: BoeData = {
	date: '2026-10-14',
	number: '247',
	pdf: '',
	sections: [
		{ code: '1', name: 'I', total: 2, items: [item('A', 'Ayudas para la vivienda en Menorca'), item('B', 'Real Decreto sobre viviendas turísticas')] },
		{ code: '3', name: 'III', total: 1, items: [item('C', 'Convenio con la Comunitat', 'MINISTERIO', 'Illes  Balears')] }
	]
};

describe('watchwords', () => {
	it('busca palabras enteras sin tildes ni mayúsculas', () => {
		expect(matches('Ayudas para la Vivienda en MENORCA', ['menorca', 'vivienda'])).toEqual(['menorca', 'vivienda']);
		expect(matches('viviendas turísticas', ['vivienda'])).toEqual([]);
		expect(matches('Régimen de Mahón', ['mahon', 'regimen'])).toEqual(['mahon', 'regimen']);
		expect(matches('Illes\nBalears', ['illes balears'])).toEqual(['illes balears']);
	});

	it('resalta los trozos que coinciden y respeta el texto original', () => {
		expect(highlight('Puerto de Maó (Menorca)', ['mao', 'Menorca'])).toEqual([
			{ text: 'Puerto de ', hit: false },
			{ text: 'Maó', hit: true },
			{ text: ' (', hit: false },
			{ text: 'Menorca', hit: true },
			{ text: ')', hit: false }
		]);
	});

	it('cuenta las disposiciones de hoy que nombran alguna palabra', () => {
		const words = ['Menorca', 'Illes Balears', 'vivienda'];
		expect(watched(boe, words).map((i) => i.id)).toEqual(['A', 'C']);
		expect(countWatchedToday(boe, words, Date.parse('2026-10-14T21:00:00Z'))).toBe(2);
		// A las 23:30 de Madrid ya es el día siguiente: ese BOE no es de hoy.
		expect(countWatchedToday(boe, words, Date.parse('2026-10-14T22:30:00Z'))).toBe(0);
		expect(countWatchedToday(undefined, words)).toBe(0);
	});
});
