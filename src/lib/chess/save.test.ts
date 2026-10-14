import { describe, expect, it, vi } from 'vitest';
import { emptyGame, loadGame, parseSaved, saveGame } from './save.ts';

describe('guardado', () => {
	it('lee una partida guardada y pone el reloj en pausa', () => {
		const raw = JSON.stringify({
			moves: ['e2e4', 'xx', 'e7e5'],
			orientation: 'b',
			clock: { base: 1, inc: 0, w: 1, b: 1, since: 123 },
			resigned: 'w'
		});
		expect(parseSaved(raw)).toEqual({
			moves: ['e2e4', 'e7e5'],
			orientation: 'b',
			clock: { base: 1, inc: 0, w: 1, b: 1, since: null },
			resigned: 'w',
			flagged: null,
			// Las partidas guardadas antes del motor eran entre dos personas.
			rival: 'human',
			human: 'w'
		});
	});

	it('ignora lo que está roto', () => {
		expect(parseSaved(null)).toBeNull();
		expect(parseSaved('{roto')).toBeNull();
		expect(parseSaved('{"moves":3}')).toBeNull();
		expect(parseSaved('{"moves":[],"orientation":"x","clock":{"base":"1"}}')).toEqual(emptyGame({ rival: 'human' }));
	});

	it('guarda y vuelve a leer', () => {
		const store = new Map<string, string>();
		vi.stubGlobal('localStorage', {
			getItem: (k: string) => store.get(k) ?? null,
			setItem: (k: string, v: string) => store.set(k, v)
		});
		saveGame({ ...emptyGame({ human: 'b', rival: 'max' }), moves: ['d2d4'] });
		expect(loadGame()).toEqual({ ...emptyGame({ human: 'b', rival: 'max' }), moves: ['d2d4'] });
	});

	it('sin localStorage (modo privado) no rompe nada', () => {
		vi.stubGlobal('localStorage', {
			getItem: () => {
				throw new Error('SecurityError');
			},
			setItem: () => {
				throw new Error('QuotaExceededError');
			}
		});
		expect(loadGame()).toBeNull();
		expect(() => saveGame(emptyGame())).not.toThrow();
	});
});
