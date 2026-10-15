import { describe, expect, it } from 'vitest';
import { allApps, dockApps, findApps, glyph, pages } from './home.ts';

describe('inicio del móvil en Modo OS', () => {
	const apps = allApps();
	it('tiene la Terminal, comandos y experiencias', () => {
		expect(apps[0].id).toBe('terminal');
		expect(apps.some((a) => a.id === 'eco' && a.href === '/eco')).toBe(true);
		expect(apps.some((a) => a.id.startsWith('x:'))).toBe(true);
	});
	it('el dock no se repite en las páginas', () => {
		const dock = dockApps(apps);
		expect(dock.map((a) => a.id)).toEqual(['top', 'imp', 'ws', 'terminal']);
		const flat = pages(apps).flat();
		expect(flat.some((a) => a.id === 'ws')).toBe(false);
		expect(flat.length + dock.length).toBe(apps.length);
		expect(pages(apps).every((p) => p.length <= 20)).toBe(true);
	});
	it('busca sin tildes y da un monograma', () => {
		expect(findApps(apps, 'periodico').length).toBe(1);
		expect(glyph({ id: 'eco', title: 'ECO', code: 'ECO' })).toBe('ECO');
	});
});
