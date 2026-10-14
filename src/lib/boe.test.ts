import { describe, expect, it } from 'vitest';
import { boeHtml, dayData } from './boe.ts';

describe('semana del BOE en la vista', () => {
	it('construye el enlace a partir del id', () => {
		expect(boeHtml('BOE-A-2026-1')).toBe('https://www.boe.es/diario_boe/txt.php?id=BOE-A-2026-1');
	});

	it('pasa un día de la semana a la forma del sumario', () => {
		const day = dayData({ date: '2026-10-13', number: '246', sections: [{ code: '1', name: 'I', total: 1, items: [{ id: 'X', title: 'T', dept: 'D', epigraph: '' }] }] });
		expect(day.sections[0].items[0]).toEqual({ id: 'X', title: 'T', dept: 'D', epigraph: '', html: boeHtml('X'), pdf: '' });
		expect(day.pdf).toBe('');
	});
});
