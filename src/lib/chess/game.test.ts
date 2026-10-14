import { describe, expect, it } from 'vitest';
import {
	checkSquare,
	destinations,
	isPromotion,
	movePairs,
	outcome,
	piecesFromFen,
	playUci,
	replay,
	resultTag,
	statusText
} from './game.ts';

const MATE = ['e2e4', 'e7e5', 'f1c4', 'b8c6', 'd1h5', 'g8f6', 'h5f7'];

describe('partida', () => {
	it('reconstruye la partida desde las jugadas UCI', () => {
		const chess = replay(['e2e4', 'e7e5', 'g1f3']);
		expect(chess.history()).toEqual(['e4', 'e5', 'Nf3']);
		expect(chess.turn()).toBe('b');
	});

	it('se para en la primera jugada ilegal o mal escrita', () => {
		expect(replay(['e2e4', 'e2e4', 'd7d5']).history()).toEqual(['e4']);
		expect(playUci(replay([]), 'hola')).toBeNull();
	});

	it('da las casillas de destino de cada pieza', () => {
		const dests = destinations(replay([]));
		expect(dests.get('e2')).toEqual(['e3', 'e4']);
		expect(dests.get('g1')?.sort()).toEqual(['f3', 'h3']);
		expect(dests.size).toBe(10);
	});

	it('detecta la coronación y corona a la pieza pedida', () => {
		const chess = replay(['a2a4', 'b7b5', 'a4b5', 'a7a6', 'b5a6', 'c8b7', 'a6a7', 'b7c6']);
		expect(isPromotion(chess, 'a7', 'b8')).toBe(true);
		expect(isPromotion(chess, 'g1', 'f3')).toBe(false);
		expect(playUci(chess, 'a7b8n')).toBe('axb8=N');
	});

	it('jaque mate: ganan las blancas, con la casilla del rey', () => {
		const chess = replay(MATE.slice(0, -1));
		expect(checkSquare(chess)).toBeUndefined();
		playUci(chess, 'h5f7');
		expect(checkSquare(chess)).toBe('e8');
		const end = outcome(chess);
		expect(end).toEqual({ winner: 'w', reason: 'jaque mate' });
		expect(statusText(chess, end)).toBe('Ganan las blancas · jaque mate');
		expect(resultTag(end)).toBe('1-0');
	});

	it('abandono y tiempo', () => {
		const chess = replay(['e2e4']);
		expect(outcome(chess)).toBeNull();
		expect(statusText(chess, null)).toBe('Juegan las negras');
		expect(outcome(chess, { resigned: 'b' })?.winner).toBe('w');
		expect(outcome(chess, { flagged: 'w' })).toEqual({ winner: 'b', reason: 'las blancas se quedan sin tiempo' });
	});

	it('ahogado: tablas', () => {
		// Mate del ahogado más corto conocido (Sam Loyd, 10 jugadas).
		const chess = replay([
			'e2e3',
			'a7a5',
			'd1h5',
			'a8a6',
			'h5a5',
			'h7h5',
			'h2h4',
			'a6h6',
			'a5c7',
			'f7f6',
			'c7d7',
			'e8f7',
			'd7b7',
			'd8d3',
			'b7b8',
			'd3h7',
			'b8c8',
			'f7g6',
			'c8e6'
		]);
		expect(outcome(chess)).toEqual({ winner: null, reason: 'ahogado' });
		expect(resultTag(outcome(chess))).toBe('1/2-1/2');
	});
});

describe('tablero', () => {
	it('lee las piezas de una FEN', () => {
		const pieces = piecesFromFen('8/8/8/8/8/8/4P3/4K2k w - - 0 1');
		expect(pieces).toEqual([
			{ square: 'e2', color: 'w', type: 'p' },
			{ square: 'e1', color: 'w', type: 'k' },
			{ square: 'h1', color: 'b', type: 'k' }
		]);
		expect(piecesFromFen(replay([]).fen())).toHaveLength(32);
	});

	it('agrupa las jugadas por parejas', () => {
		expect(movePairs(['e4', 'e5', 'Nf3'])).toEqual([
			{ n: 1, w: 'e4', b: 'e5' },
			{ n: 2, w: 'Nf3', b: undefined }
		]);
	});
});
