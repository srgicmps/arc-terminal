import { describe, expect, it } from 'vitest';
import { boeHtml, dayData, latestWatched } from './boe.ts';

describe('semana del BOE en la vista', () => {
	it('construye el enlace a partir del id', () => {
		expect(boeHtml('BOE-A-2026-1')).toBe('https://www.boe.es/diario_boe/txt.php?id=BOE-A-2026-1');
	});

	it('pasa un día de la semana a la forma del sumario', () => {
		const day = dayData({ date: '2026-10-13', number: '246', sections: [{ code: '1', name: 'I', total: 1, items: [{ id: 'X', title: 'T', dept: 'D', epigraph: '' }] }] });
		expect(day.sections[0].items[0]).toEqual({ id: 'X', title: 'T', dept: 'D', epigraph: '', html: boeHtml('X'), pdf: '' });
		expect(day.pdf).toBe('');
	});

	it('cuenta las palabras vigiladas del último sumario', () => {
		const item = (id: string, title: string) => ({ id, title, dept: 'Ministerio de Vivienda', epigraph: '' });
		const week = {
			days: [
				{ date: '2026-10-13', number: '246', sections: [{ code: '1', name: 'I', total: 2, items: [item('A', 'Ayudas en Menorca'), item('B', 'Otra cosa')] }] },
				{ date: '2026-10-12', number: '245', sections: [{ code: '1', name: 'I', total: 1, items: [item('C', 'Menorca')] }] }
			]
		};
		expect(latestWatched(week, ['menorca'])).toEqual({ date: '2026-10-13', count: 1 });
		expect(latestWatched(week, ['vivienda'])?.count).toBe(2);
		expect(latestWatched(week, [])).toBeNull();
		expect(latestWatched(null, ['menorca'])).toBeNull();
	});
});
