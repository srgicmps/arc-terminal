import { describe, expect, it } from 'vitest';
import { SOUNDS } from './sounds.ts';
import { parseSettings } from './settings.ts';

describe('ajustes del sistema', () => {
	it('por defecto: arranque sí, sonidos no', () => {
		expect(parseSettings(null)).toEqual({ boot: true, sounds: false });
		expect(parseSettings('no es json')).toEqual({ boot: true, sounds: false });
	});
	it('lee lo guardado y descarta lo raro', () => {
		expect(parseSettings('{"boot":false,"sounds":true}')).toEqual({ boot: false, sounds: true });
		expect(parseSettings('{"sounds":"sí"}')).toEqual({ boot: true, sounds: false });
	});
	it('sonidos discretos', () => {
		for (const s of Object.values(SOUNDS)) expect(s.gain).toBeLessThanOrEqual(0.05);
	});
});
