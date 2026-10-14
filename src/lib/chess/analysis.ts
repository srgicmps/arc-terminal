// «Analizar» de CHESS: con la valoración del motor antes y después de cada jugada, marca las
// imprecisiones, los errores y los errores graves. Como Lichess, se mide cuánta probabilidad de ganar
// pierde el que mueve (la curva de scoreToBar), no los centipeones: perder un peón con +8 no importa.
import type { Chess } from 'chess.js';
import { outcome, type Color } from './game.ts';
import { scoreToBar, type Score } from './uci.ts';

export type Mark = 'blunder' | 'mistake' | 'inaccuracy';

/** Umbrales de pérdida de probabilidad de ganar (de 0 a 1). */
const LIMITS: [Mark, number][] = [
	['blunder', 0.15],
	['mistake', 0.1],
	['inaccuracy', 0.05]
];

export const MARK_SIGN: Record<Mark, string> = { blunder: '??', mistake: '?', inaccuracy: '?!' };
export const MARK_NAME: Record<Mark, [string, string]> = {
	blunder: ['error grave', 'errores graves'],
	mistake: ['error', 'errores'],
	inaccuracy: ['imprecisión', 'imprecisiones']
};

/** Probabilidad de ganar del bando `color` con esta valoración (que va desde el lado de las blancas). */
export const winChance = (score: Score, color: Color) => (color === 'w' ? scoreToBar(score) : 1 - scoreToBar(score));

/** Marca de una jugada de `mover` que lleva la valoración de `before` a `after`, o null si es buena. */
export function classify(before: Score, after: Score, mover: Color): Mark | null {
	const loss = winChance(before, mover) - winChance(after, mover);
	return LIMITS.find(([, min]) => loss >= min)?.[0] ?? null;
}

/** Valoración de una posición acabada (mate, tablas), sin preguntar al motor. */
export function finalScore(chess: Chess): Score | null {
	const end = outcome(chess);
	if (!end) return null;
	if (!end.winner) return { cp: 0 };
	return { mate: end.winner === 'w' ? 1 : -1 };
}

export interface MoveNote {
	mark: Mark | null;
	/** Mejor jugada en la posición de antes (UCI), si la jugada fue mala. */
	best?: string;
}

/**
 * Notas de cada jugada. `evals[i]` es la valoración tras `i` medias jugadas (evals[0], la posición inicial),
 * y `bests[i]`, la mejor jugada en esa posición. Las blancas mueven en las jugadas pares.
 */
export function annotate(evals: readonly Score[], bests: readonly (string | null)[]): MoveNote[] {
	const notes: MoveNote[] = [];
	for (let i = 1; i < evals.length; i++) {
		const mover: Color = i % 2 === 1 ? 'w' : 'b';
		const mark = classify(evals[i - 1], evals[i], mover);
		notes.push(mark ? { mark, best: bests[i - 1] ?? undefined } : { mark: null });
	}
	return notes;
}

/** «2 errores graves, 1 error» para un bando, o «sin errores». */
export function summary(notes: readonly MoveNote[], color: Color): string {
	const mine = notes.filter((_, i) => (i % 2 === 0 ? 'w' : 'b') === color);
	const parts = LIMITS.map(([mark]) => {
		const n = mine.filter((m) => m.mark === mark).length;
		return n ? `${n} ${MARK_NAME[mark][n === 1 ? 0 : 1]}` : '';
	}).filter(Boolean);
	return parts.length ? parts.join(', ') : 'sin errores';
}
