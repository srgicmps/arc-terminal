import { describe, expect, it } from 'vitest';
import { PINS, reconcilePins, setPinSpan, togglePin } from './pins.ts';

describe('pins', () => {
	it('fija al final y suelta', () => {
		const a = togglePin([], 'pin:x');
		expect(a).toEqual([{ id: 'pin:x', span: 1 }]);
		expect(togglePin(a, 'pin:x')).toEqual([]);
	});

	it('cambia el ancho', () => {
		expect(setPinSpan([{ id: 'pin:x', span: 1 }], 'pin:x', 3)).toEqual([{ id: 'pin:x', span: 3 }]);
	});

	it('limpia lo guardado', () => {
		const saved = [{ id: 'pin:a', span: 2 }, { id: 'pin:a' }, { id: 'pin:viejo' }, { id: 'pin:b', span: 9 }, null];
		expect(reconcilePins(saved, ['pin:a', 'pin:b'])).toEqual([
			{ id: 'pin:a', span: 2 },
			{ id: 'pin:b', span: 1 }
		]);
		expect(reconcilePins('roto')).toEqual([]);
	});

	it('ids «pin:<vista>:<panel>» y únicos', () => {
		const ids = PINS.map((p) => p.id);
		expect(new Set(ids).size).toBe(ids.length);
		for (const id of ids) expect(id).toMatch(/^pin:[a-z]+:[a-z-]+$/);
	});
});
