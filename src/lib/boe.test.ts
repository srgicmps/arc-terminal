import { describe, expect, it } from 'vitest';
import { boeHtml, boeToday, dayData, latestWatched } from './boe.ts';
import type { BoeData } from './types.ts';
import { watched } from './watchwords.ts';

const item = (id: string, title: string, dept: string, epigraph = '') => ({ id, title, dept, epigraph, html: '', pdf: '' });
const boe: BoeData = {
	date: '2026-10-20',
	number: '252',
	pdf: '',
	sections: [
		{ code: '1', name: 'I', total: 2, items: [item('A', 'Ayudas en Menorca', 'Ministerio de Vivienda'), item('B', 'Otra cosa', 'Ministerio de Hacienda')] },
		{ code: '5A', name: 'V-A', total: 40, items: [item('C', 'Licitación de obras', 'Consejo Insular', 'Menorca')] }
	]
};

describe('BOE: la semana en la vista y el recorte de TOP', () => {
	it('construye el enlace a partir del id', () => {
		expect(boeHtml('BOE-A-2026-1')).toBe('https://www.boe.es/diario_boe/txt.php?id=BOE-A-2026-1');
	});

	it('pasa un día de la semana a la forma del sumario', () => {
		const day = dayData({ date: '2026-10-13', number: '246', sections: [{ code: '1', name: 'I', total: 1, items: [{ id: 'X', title: 'T', dept: 'D', epigraph: '' }] }] });
		expect(day.sections[0].items[0]).toEqual({ id: 'X', title: 'T', dept: 'D', epigraph: '', html: boeHtml('X'), pdf: '' });
		expect(day.pdf).toBe('');
	});

	it('recorta el sumario a la fecha y el texto de cada disposición', () => {
		expect(boeToday(boe)).toEqual({
			date: '2026-10-20',
			texts: ['Ayudas en Menorca Ministerio de Vivienda ', 'Otra cosa Ministerio de Hacienda ', 'Licitación de obras Consejo Insular Menorca']
		});
	});

	it('cuenta las palabras vigiladas del último sumario', () => {
		const today = boeToday(boe);
		expect(latestWatched(today, ['menorca'])).toEqual({ date: '2026-10-20', count: 2 });
		expect(latestWatched(today, ['vivienda'])).toEqual({ date: '2026-10-20', count: 1 });
		expect(latestWatched(today, ['menorca', 'vivienda'])?.count).toBe(2);
		expect(latestWatched(today, ['Hacienda'])?.count).toBe(1);
		expect(latestWatched(today, [])).toBeNull();
		expect(latestWatched(null, ['menorca'])).toBeNull();
	});

	it('cuenta lo mismo que la vista BOE con el sumario entero', () => {
		const today = boeToday(boe);
		for (const words of [['menorca'], ['vivienda'], ['obras', 'hacienda'], ['nada']]) {
			expect(latestWatched(today, words)?.count).toBe(watched(boe, words).length);
		}
	});
});
