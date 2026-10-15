import { describe, expect, it } from 'vitest';
import { ESSENTIAL, install, isInstalled, MAX_REMOVED, parsePackages, remove } from './packages.ts';

describe('packages', () => {
	it('por defecto todo está instalado', () => {
		const s = parsePackages(null);
		expect(s.removed).toEqual([]);
		expect(isInstalled('eco', s)).toBe(true);
	});

	it('quitar e instalar', () => {
		let s = remove('eco', { removed: [] });
		expect(isInstalled('eco', s)).toBe(false);
		expect(remove('eco', s)).toBe(s);
		s = install('eco', s);
		expect(isInstalled('eco', s)).toBe(true);
	});

	it('las esenciales no se quitan', () => {
		for (const id of ESSENTIAL) expect(isInstalled(id, remove(id, { removed: [] }))).toBe(true);
		expect(isInstalled('paquetes', { removed: ['paquetes'] })).toBe(true);
	});

	it('valida lo guardado', () => {
		expect(parsePackages('nada')).toEqual({ removed: [] });
		expect(parsePackages('[1,2]')).toEqual({ removed: [] });
		expect(
			parsePackages(JSON.stringify({ removed: ['eco', 'eco', 'x:zen', 3, 'MAL ID', 'ajustes', 'a'.repeat(99)] }))
		).toEqual({ removed: ['eco', 'x:zen'] });
	});

	it('respeta el tope', () => {
		const many = Array.from({ length: MAX_REMOVED + 10 }, (_, i) => `app${i}`);
		const s = parsePackages(JSON.stringify({ removed: many }));
		expect(s.removed).toHaveLength(MAX_REMOVED);
		expect(remove('otra', s)).toBe(s);
	});
});
