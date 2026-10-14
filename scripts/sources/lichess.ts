// Problema del día de Lichess (GET https://lichess.org/api/puzzle/daily, sin clave). Una vez al día.
// Los problemas de Lichess son de dominio público (CC0): https://database.lichess.org/#puzzles
// La API da la partida hasta el problema (PGN) y la solución en UCI; aquí se calcula la posición con
// chess.js para que la web no tenga que repetir la partida.
import { Chess } from 'chess.js';
import type { Puzzle } from '../../src/lib/chess/puzzle.ts';
import { getJson, madridDay, type Source } from '../lib.ts';

type Raw = Record<string, any>;

/** Convierte la respuesta de la API en el problema listo para el tablero. */
export function parsePuzzle(body: Raw, date: string): Puzzle {
	const id = String(body.puzzle?.id ?? '');
	const solution: string[] = Array.isArray(body.puzzle?.solution) ? body.puzzle.solution.map(String) : [];
	const pgn = String(body.game?.pgn ?? '').trim();
	if (!id || !solution.length || !pgn) throw new Error('problema de Lichess sin id, solución o partida');
	const chess = new Chess();
	const sans = pgn.split(/\s+/).filter((t) => t && !/^\d+\.+$/.test(t));
	for (const san of sans.slice(0, -1)) chess.move(san);
	const fen = chess.fen();
	const last = chess.move(sans.at(-1)!);
	const lastMove = `${last.from}${last.to}${last.promotion ?? ''}`;
	// La primera jugada de la solución tiene que ser legal tras la del rival; si no, algo ha cambiado en la API.
	try {
		chess.move({ from: solution[0].slice(0, 2), to: solution[0].slice(2, 4), promotion: solution[0][4] });
	} catch {
		throw new Error(`la solución de ${id} no encaja con la partida`);
	}
	return {
		id,
		date,
		rating: Number(body.puzzle?.rating) || 0,
		themes: Array.isArray(body.puzzle?.themes) ? body.puzzle.themes.map(String) : [],
		fen,
		lastMove,
		solution,
		url: `https://lichess.org/training/${id}`
	};
}

export const lichess: Source<Puzzle> = {
	name: 'lichess',
	label: 'Problema del día · Lichess (CC0)',
	// Cambia una vez al día: con 6 h basta y casi siempre se reutiliza la copia.
	maxAgeMinutes: 6 * 60,
	// Si la copia es de otro día, se descarga aunque sea reciente.
	isStale: (previous) => previous.date !== madridDay(),
	async fetch() {
		const body = await getJson<Raw>('https://lichess.org/api/puzzle/daily');
		return parsePuzzle(body, madridDay());
	}
};
