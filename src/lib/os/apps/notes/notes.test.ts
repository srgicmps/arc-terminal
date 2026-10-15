import { describe, expect, it } from 'vitest';
import { byRecent, isNote, plainText, snippetOf, titleOf, whenText, type Note } from './notes.ts';

const n = (html: string, updated = 0, pinned = false): Note => ({ id: 'a', html, updated, pinned });

describe('Notas', () => {
	it('saca el título y el resumen del HTML', () => {
		const note = n('<h3>Compra</h3><ul><li>Pan &amp; leche</li><li>Fruta</li></ul>');
		expect(titleOf(note)).toBe('Compra');
		expect(snippetOf(note)).toBe('Pan & leche · Fruta');
		expect(titleOf(n('<p><br></p>'))).toBe('Nota nueva');
		expect(plainText('a<br>b')).toBe('a\nb');
		expect(titleOf(n('Lista<div><ul><li>Pan</li></ul></div>'))).toBe('Lista');
		expect(plainText('a<script>alert(1)</script>b')).toBe('ab');
	});

	it('ordena con las fijadas primero', () => {
		const list = [n('x', 3), n('y', 1, true), n('z', 5)];
		expect(list.sort(byRecent).map((x) => x.html)).toEqual(['y', 'z', 'x']);
	});

	it('valida lo guardado', () => {
		expect(isNote(n('x'))).toBe(true);
		expect(isNote({ id: 'a' })).toBe(false);
		expect(isNote(null)).toBe(false);
	});

	it('dice cuándo', () => {
		const now = new Date(2026, 9, 15, 12).getTime();
		expect(whenText(new Date(2026, 9, 14, 9).getTime(), now)).toBe('ayer');
		expect(whenText(new Date(2026, 9, 15, 9, 5).getTime(), now)).toBe('09:05');
	});
});
