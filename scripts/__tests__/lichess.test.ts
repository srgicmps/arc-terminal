// Problema del día de Lichess (/api/puzzle/daily).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkMove, puzzleStart, puzzleThemes } from '../../src/lib/chess/puzzle.ts';
import { lichess, parsePuzzle } from '../sources/lichess.ts';
import { mockFetch } from './mock.ts';

beforeEach(() => {
	vi.useFakeTimers({ toFake: ['Date'] });
	vi.setSystemTime(new Date('2026-10-14T10:00:00Z'));
});
afterEach(() => vi.useRealTimers());

/** Con la forma de la API: la partida en SAN sin números y la solución en UCI. */
const body = (over: Record<string, unknown> = {}) => ({
	game: {
		id: 'abcd1234',
		perf: { key: 'blitz', name: 'Blitz' },
		rated: true,
		pgn: 'e4 e5 Qh5 Nc6 Bc4 Nf6',
		clock: '3+0'
	},
	puzzle: {
		id: 'K69di',
		rating: 1012,
		plays: 5000,
		initialPly: 5,
		solution: ['h5f7'],
		themes: ['mateIn1', 'oneMove', 'opening'],
		...over
	}
});

describe('lichess', () => {
	it('calcula la posición y la última jugada del rival', () => {
		const p = parsePuzzle(body(), '2026-10-14');
		expect(p).toMatchObject({
			id: 'K69di',
			rating: 1012,
			lastMove: 'g8f6',
			solution: ['h5f7'],
			url: 'https://lichess.org/training/K69di'
		});
		expect(p.fen).toBe('r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3');
		const { chess, color } = puzzleStart(p);
		expect(color).toBe('w');
		expect(chess.history()).toEqual(['Nf6']);
		expect(puzzleThemes(p)).toEqual(['Mate en 1', 'Apertura']);
	});

	it('acepta la solución y cualquier otro mate; rechaza lo demás', () => {
		const p = parsePuzzle(body(), '2026-10-14');
		expect(checkMove(p, [], 'h5f7')).toBe(true);
		expect(checkMove(p, [], 'c4f7')).toBe(false);
		expect(checkMove(p, ['h5f7'], 'e8e7')).toBe(false);
	});

	it('falla si la solución no encaja con la partida o falta algo', () => {
		expect(() => parsePuzzle(body({ solution: ['a1a8'] }), 'x')).toThrow('no encaja');
		expect(() => parsePuzzle({ puzzle: { id: 'x' } }, 'x')).toThrow('sin id');
	});

	it('descarga una vez al día', async () => {
		const fetch = mockFetch((url) => (url === 'https://lichess.org/api/puzzle/daily' ? body() : undefined));
		const p = await lichess.fetch(undefined);
		expect(p.date).toBe('2026-10-14');
		expect(fetch).toHaveBeenCalledTimes(1);
		expect(lichess.isStale!({ ...p, date: '2026-10-13' })).toBe(true);
		expect(lichess.isStale!(p)).toBe(false);
	});
});
