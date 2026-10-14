// Problema del día de Lichess (CHESS y el módulo de TOP). La fuente (scripts/sources/lichess.ts) guarda
// la posición ya calculada; aquí está la lógica para resolverlo, sin interfaz, para poder probarla.
import { Chess } from 'chess.js';
import { playUci, type Color, type Uci } from './game.ts';

export interface Puzzle {
	id: string;
	/** Día (AAAA-MM-DD, hora de Madrid) en que se descargó. */
	date: string;
	rating: number;
	themes: string[];
	/** Posición de partida: la del rival justo antes de su última jugada. */
	fen: string;
	/** La jugada del rival que abre el problema (se ve en el tablero como último movimiento). */
	lastMove: Uci;
	/** Solución en UCI: jugada tuya, respuesta del rival, jugada tuya… */
	solution: Uci[];
	/** Enlace al problema en Lichess. */
	url: string;
}

/** Posición en la que empiezas tú (después de la jugada del rival) y el bando con el que juegas. */
export function puzzleStart(p: Puzzle): { chess: Chess; color: Color } {
	const chess = new Chess(p.fen);
	playUci(chess, p.lastMove);
	return { chess, color: chess.turn() };
}

/**
 * Comprueba la jugada número `step` de la solución (las pares son tuyas). Vale también cualquier jugada
 * que dé mate, como en Lichess, aunque no sea la de la solución.
 */
export function checkMove(p: Puzzle, played: readonly Uci[], move: Uci): boolean {
	const expected = p.solution[played.length];
	if (!expected) return false;
	if (move === expected) return true;
	const { chess } = puzzleStart(p);
	for (const m of played) playUci(chess, m);
	return playUci(chess, move) !== null && chess.isCheckmate();
}

/** Temas más habituales, en español. Los demás se dejan como vienen. */
const THEMES: Record<string, string> = {
	mate: 'Mate',
	mateIn1: 'Mate en 1',
	mateIn2: 'Mate en 2',
	mateIn3: 'Mate en 3',
	mateIn4: 'Mate en 4',
	mateIn5: 'Mate en 5',
	fork: 'Ataque doble',
	pin: 'Clavada',
	skewer: 'Enfilada',
	sacrifice: 'Sacrificio',
	discoveredAttack: 'Ataque a la descubierta',
	doubleCheck: 'Jaque doble',
	hangingPiece: 'Pieza colgada',
	trappedPiece: 'Pieza atrapada',
	deflection: 'Desviación',
	attraction: 'Atracción',
	clearance: 'Despeje',
	interference: 'Interferencia',
	intermezzo: 'Jugada intermedia',
	quietMove: 'Jugada tranquila',
	defensiveMove: 'Jugada defensiva',
	zugzwang: 'Zugzwang',
	promotion: 'Coronación',
	underPromotion: 'Subpromoción',
	advancedPawn: 'Peón avanzado',
	kingsideAttack: 'Ataque al flanco de rey',
	queensideAttack: 'Ataque al flanco de dama',
	backRankMate: 'Mate en la última fila',
	smotheredMate: 'Mate de la coz',
	opening: 'Apertura',
	middlegame: 'Medio juego',
	endgame: 'Final',
	rookEndgame: 'Final de torres',
	pawnEndgame: 'Final de peones',
	queenEndgame: 'Final de damas',
	bishopEndgame: 'Final de alfiles',
	knightEndgame: 'Final de caballos',
	crushing: 'Ventaja decisiva',
	advantage: 'Ventaja',
	equality: 'Igualar',
	short: 'Corto',
	long: 'Largo',
	veryLong: 'Muy largo',
	oneMove: 'Una jugada',
	master: 'Partida de maestros',
	masterVsMaster: 'Entre maestros',
	superGM: 'Súper GM',
	exposedKing: 'Rey expuesto',
	capturingDefender: 'Capturar al defensor',
	xRayAttack: 'Ataque de rayos X',
	castling: 'Enroque',
	enPassant: 'Al paso'
};

export const themeName = (t: string) => THEMES[t] ?? t;

/** Temas para enseñar: sin los de longitud, que no dicen nada del problema. */
export function puzzleThemes(p: Puzzle, max = 3): string[] {
	return p.themes
		.filter((t) => !['short', 'long', 'veryLong', 'oneMove'].includes(t))
		.slice(0, max)
		.map(themeName);
}
