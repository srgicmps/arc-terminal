import { describe, expect, it } from 'vitest';
import { CATEGORIES, parseSection, searchSettings, SECTION_IDS, SECTIONS } from './sections.ts';

describe('secciones de Ajustes', () => {
	it('no repiten ids y cada una tiene categoría', () => {
		expect(new Set(SECTION_IDS).size).toBe(SECTIONS.length);
		for (const s of SECTIONS) expect(CATEGORIES.some((c) => c.id === s.cat), s.id).toBe(true);
	});

	it('mantiene los ids de antes (enlaces guardados)', () => {
		for (const id of ['apariencia', 'escritorio', 'sistema', 'avisos', 'cuenta', 'region', 'atajos', 'acerca']) expect(SECTION_IDS).toContain(id);
	});

	it('lee la sección de la ruta de la ventana', () => {
		expect(parseSection('apariencia')).toBe('apariencia');
		expect(parseSection('/widgets')).toBe('widgets');
		expect(parseSection('?s=copia')).toBe('copia');
		expect(parseSection('#Atajos')).toBe('atajos');
		expect(parseSection('/no-existe')).toBeNull();
		expect(parseSection(undefined)).toBeNull();
	});

	it('busca secciones y ajustes sueltos, sin tildes', () => {
		expect(searchSettings('')).toEqual([]);
		expect(searchSettings('sonidos')[0].section.id).toBe('sonidos');
		const tema = searchSettings('tema');
		expect(tema.some((h) => h.section.id === 'apariencia' && h.item)).toBe(true);
		expect(searchSettings('region')[0].section.id).toBe('region');
	});

	it('no ofrece elegir el aspecto del escritorio (Arc OS va siempre con «Mando»)', () => {
		expect(SECTION_IDS).not.toContain('barra');
		for (const q of ['aspecto', 'barra de tareas', 'skin']) expect(searchSettings(q), q).toEqual([]);
	});
});
