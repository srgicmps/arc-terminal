import { describe, expect, it } from 'vitest';
import { annotate, classify, finalScore, summary } from './analysis.ts';
import { replay } from './game.ts';

describe('análisis', () => {
	it('clasifica por la probabilidad de ganar que se pierde', () => {
		expect(classify({ cp: 30 }, { cp: 10 }, 'w')).toBeNull();
		expect(classify({ cp: 30 }, { cp: -300 }, 'w')).toBe('blunder');
		expect(classify({ cp: 0 }, { cp: -130 }, 'w')).toBe('mistake');
		expect(classify({ cp: 0 }, { cp: -60 }, 'w')).toBe('inaccuracy');
		// Desde el lado de las negras: que suba la valoración es malo para ellas.
		expect(classify({ cp: 0 }, { cp: 400 }, 'b')).toBe('blunder');
		// Con +8 ya ganado, perder un peón no es un error.
		expect(classify({ cp: 800 }, { cp: 700 }, 'w')).toBeNull();
		// Dejar escapar un mate sí.
		expect(classify({ mate: 2 }, { cp: 0 }, 'w')).toBe('blunder');
	});

	it('valora las posiciones acabadas sin motor', () => {
		expect(finalScore(replay(['e2e4', 'e7e5', 'f1c4', 'b8c6', 'd1h5', 'g8f6', 'h5f7']))).toEqual({ mate: 1 });
		expect(finalScore(replay(['e2e4']))).toBeNull();
	});

	it('anota cada jugada y resume por bandos', () => {
		// Blancas bien, negras error grave, blancas imprecisión.
		const notes = annotate([{ cp: 20 }, { cp: 25 }, { cp: 400 }, { cp: 250 }], ['e2e4', 'e7e5', 'd2d4', null]);
		expect(notes).toEqual([{ mark: null }, { mark: 'blunder', best: 'e7e5' }, { mark: 'inaccuracy', best: 'd2d4' }]);
		expect(summary(notes, 'w')).toBe('1 imprecisión');
		expect(summary(notes, 'b')).toBe('1 error grave');
		expect(summary([{ mark: null }], 'w')).toBe('sin errores');
	});
});
