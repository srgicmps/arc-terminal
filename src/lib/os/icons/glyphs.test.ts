import { describe, expect, it } from 'vitest';
import { APPS } from '../apps.ts';
import { GLYPHS, hasIcon, iconOf } from './glyphs.ts';

const PATH = /^[MmLlHhVvCcSsQqTtAaZz0-9.,\-\s]*$/;
const HEX = /^#[0-9a-f]{6}$/;
const SYSTEM = ['folder', 'folder-open', 'file', 'trash', 'trash-full', 'settings', 'wallpaper', 'search', 'calculadora', 'reloj', 'notas', 'monitor', 'explorador', 'terminal'];

describe('iconos de Arc OS', () => {
	it('cada app tiene icono propio, y también los de sistema', () => {
		for (const a of APPS) expect(hasIcon(a.id), a.id).toBe(true);
		for (const id of SYSTEM) expect(hasIcon(id), id).toBe(true);
	});

	it('los dibujos son paths SVG y los colores #rrggbb', () => {
		for (const [id, g] of Object.entries(GLYPHS)) {
			expect(g.d || g.f, id).toBeTruthy();
			expect(g.d, id).toMatch(PATH);
			if (g.f) expect(g.f, id).toMatch(PATH);
			expect(g.d.startsWith('M') || !g.d, id).toBe(true);
			for (const h of g.hue) expect(h, id).toMatch(HEX);
		}
	});

	it('un id desconocido tiene color estable y la cuadrícula genérica', () => {
		const a = iconOf('desconocida');
		expect(a).toEqual(iconOf('desconocida'));
		expect(hasIcon('desconocida')).toBe(false);
		for (const h of a.hue) expect(h).toMatch(HEX);
		expect(a.d).toMatch(PATH);
		expect(iconOf('otra').hue).not.toEqual(a.hue);
	});
});
