import { describe, expect, it } from 'vitest';
import { EXPERIENCES, findExperience, fromHomeValue, homeValue, type Experience } from './experiences.ts';

const LIST: Experience[] = [
	{ id: 'periodico', name: 'Periódico', desc: '', icon: '▤', order: 10, aliases: ['diario'] },
	{ id: 'sala', name: 'Sala de control', desc: '', icon: '◎', order: 20 }
];

describe('experiencias', () => {
	it('el registro no repite ids ni posiciones, y los ids van sin tildes ni espacios', () => {
		expect(new Set(EXPERIENCES.map((e) => e.id)).size).toBe(EXPERIENCES.length);
		expect(new Set(EXPERIENCES.map((e) => e.order)).size).toBe(EXPERIENCES.length);
		for (const e of EXPERIENCES) expect(e.id).toMatch(/^[a-z0-9-]+$/);
	});

	it('encuentra por id, nombre, alias o principio, sin tildes ni mayúsculas', () => {
		expect(findExperience('periodico', LIST)?.id).toBe('periodico');
		expect(findExperience('PERIÓDICO', LIST)?.id).toBe('periodico');
		expect(findExperience('diario', LIST)?.id).toBe('periodico');
		expect(findExperience('sala de control', LIST)?.id).toBe('sala');
		expect(findExperience('sal', LIST)?.id).toBe('sala');
		expect(findExperience('nada', LIST)).toBeNull();
		expect(findExperience('', LIST)).toBeNull();
	});

	it('«Al entrar» la guarda como x:<id>', () => {
		expect(homeValue(LIST[1])).toBe('x:sala');
		expect(fromHomeValue('x:sala', LIST)?.id).toBe('sala');
		expect(fromHomeValue('x:otra', LIST)).toBeNull();
		expect(fromHomeValue('IMP', LIST)).toBeNull();
	});
});

describe('rutas de las experiencias', () => {
	it('cada experiencia tiene su vista en src/routes/x/<id> y cada vista, su entrada', () => {
		const pages = Object.keys(import.meta.glob('/src/routes/x/*/+page.svelte')).map((p) => p.split('/')[4]);
		expect(pages.sort()).toEqual(EXPERIENCES.map((e) => e.id).sort());
	});
});
