import { describe, expect, it } from 'vitest';
import { currentEdition, editionWindow, inEdition } from './periodico.ts';

// 15 de octubre de 2026: Madrid va en UTC+2.
const at = (hm: string) => Date.parse(`2026-10-15T${hm}:00+02:00`);

describe('ediciones del periódico', () => {
	it('mañana hasta las 14:00, tarde después', () => {
		expect(currentEdition(at('09:00'))).toBe('manana');
		expect(currentEdition(at('15:30'))).toBe('tarde');
	});

	it('la de tarde, por la mañana, es la de ayer', () => {
		const w = editionWindow(at('09:00'), 'tarde');
		expect(w.yesterday).toBe(true);
		expect(w.from).toBe(Date.parse('2026-10-14T14:00:00+02:00'));
		expect(w.to).toBe(Date.parse('2026-10-15T00:00:00+02:00'));
		expect(editionWindow(at('16:00'), 'tarde').from).toBe(at('14:00'));
		expect(editionWindow(at('16:00'), 'manana').from).toBe(Date.parse('2026-10-14T20:00:00+02:00'));
	});

	it('rellena con lo anterior si la franja trae poco, y nunca con lo posterior', () => {
		const win = { from: at('14:00'), to: at('23:59') };
		const items = [{ time: '2026-10-15T15:00:00+02:00' }, { time: '2026-10-15T10:00:00+02:00' }, { time: '2026-10-15T09:00:00+02:00' }, { time: null }];
		expect(inEdition(items, win).map((i) => i.time)).toEqual(['2026-10-15T15:00:00+02:00', '2026-10-15T10:00:00+02:00', '2026-10-15T09:00:00+02:00']);
		const morning = { from: at('00:00'), to: at('09:30') };
		expect(inEdition(items, morning, 1).map((i) => i.time)).toEqual(['2026-10-15T09:00:00+02:00']);
	});
});
