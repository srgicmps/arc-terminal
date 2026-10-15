import { describe, expect, it } from 'vitest';
import { fadeSide } from './edgefade.ts';

describe('fadeSide', () => {
	it('sin nada escondido, sin fundido', () => expect(fadeSide(0, 390, 390)).toBe(''));
	it('al principio, solo a la derecha', () => expect(fadeSide(0, 390, 800)).toBe('end'));
	it('en medio, a los dos lados', () => expect(fadeSide(200, 390, 800)).toBe('both'));
	it('al final, solo a la izquierda', () => expect(fadeSide(410, 390, 800)).toBe('start'));
	it('tolera medio píxel de redondeo', () => expect(fadeSide(409.5, 390, 800)).toBe('start'));
});
