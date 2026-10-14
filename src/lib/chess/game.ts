// Lógica de la partida de CHESS, sin interfaz: así se puede probar con Vitest. Las reglas (jugadas legales,
// jaque, tablas…) las pone chess.js; aquí solo está lo nuestro: la partida como una lista de jugadas,
// el estado para el panel y el reloj.
import { Chess, type Color, type PieceSymbol, type Square } from 'chess.js';

export type { Color, PieceSymbol, Square };

/** Una jugada en notación UCI («e2e4», «e7e8q»): la misma que habla el motor. */
export type Uci = string;

export const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;

export const other = (c: Color): Color => (c === 'w' ? 'b' : 'w');

export const colorName = (c: Color) => (c === 'w' ? 'blancas' : 'negras');

/** Reconstruye la partida desde la posición inicial con la lista de jugadas. Si una no es legal, para ahí. */
export function replay(moves: readonly Uci[]): Chess {
	const chess = new Chess();
	for (const m of moves) if (!playUci(chess, m)) break;
	return chess;
}

/** Juega una jugada UCI. Devuelve la jugada en notación algebraica (SAN), o null si no es legal. */
export function playUci(chess: Chess, uci: Uci): string | null {
	const m = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/.exec(uci);
	if (!m) return null;
	try {
		return chess.move({ from: m[1], to: m[2], promotion: m[3] }).san;
	} catch {
		// chess.js 1.x lanza una excepción con las jugadas ilegales.
		return null;
	}
}

/** Casillas a las que puede ir cada pieza del bando que mueve (para el tablero). */
export function destinations(chess: Chess): Map<Square, Square[]> {
	const dests = new Map<Square, Square[]>();
	for (const m of chess.moves({ verbose: true })) {
		const list = dests.get(m.from);
		if (list) {
			if (!list.includes(m.to)) list.push(m.to);
		} else dests.set(m.from, [m.to]);
	}
	return dests;
}

/** Si ir de `from` a `to` es una coronación (hay que preguntar la pieza). */
export function isPromotion(chess: Chess, from: Square, to: Square): boolean {
	return chess.moves({ square: from, verbose: true }).some((m) => m.to === to && !!m.promotion);
}

/** Casilla del rey del bando que mueve si está en jaque. */
export function checkSquare(chess: Chess): Square | undefined {
	if (!chess.inCheck()) return undefined;
	const turn = chess.turn();
	for (const row of chess.board()) for (const p of row) if (p && p.type === 'k' && p.color === turn) return p.square;
	return undefined;
}

/** Piezas de una posición FEN, casilla a casilla (solo la primera parte de la FEN). */
export function piecesFromFen(fen: string): { square: Square; color: Color; type: PieceSymbol }[] {
	const out: { square: Square; color: Color; type: PieceSymbol }[] = [];
	const rows = fen.split(' ')[0].split('/');
	rows.forEach((row, i) => {
		const rank = 8 - i;
		let file = 0;
		for (const ch of row) {
			if (/\d/.test(ch)) file += Number(ch);
			else {
				const color: Color = ch === ch.toUpperCase() ? 'w' : 'b';
				out.push({ square: `${FILES[file]}${rank}` as Square, color, type: ch.toLowerCase() as PieceSymbol });
				file++;
			}
		}
	});
	return out;
}

/** Jugadas en parejas para el historial: «1. e4 e5». */
export function movePairs(san: readonly string[]): { n: number; w: string; b?: string }[] {
	const pairs: { n: number; w: string; b?: string }[] = [];
	for (let i = 0; i < san.length; i += 2) pairs.push({ n: i / 2 + 1, w: san[i], b: san[i + 1] });
	return pairs;
}

/** Cómo ha acabado la partida, o null si sigue. */
export interface Outcome {
	/** Ganador, o null si son tablas. */
	winner: Color | null;
	/** Motivo, en español: «jaque mate», «ahogado», «sin tiempo»… */
	reason: string;
}

export function outcome(chess: Chess, extra: { resigned?: Color | null; flagged?: Color | null } = {}): Outcome | null {
	if (chess.isCheckmate()) return { winner: other(chess.turn()), reason: 'jaque mate' };
	if (chess.isStalemate()) return { winner: null, reason: 'ahogado' };
	if (chess.isInsufficientMaterial()) return { winner: null, reason: 'material insuficiente' };
	if (chess.isThreefoldRepetition()) return { winner: null, reason: 'triple repetición' };
	if (chess.isDrawByFiftyMoves()) return { winner: null, reason: 'regla de las 50 jugadas' };
	if (extra.resigned) return { winner: other(extra.resigned), reason: `abandonan las ${colorName(extra.resigned)}` };
	if (extra.flagged)
		return { winner: other(extra.flagged), reason: `las ${colorName(extra.flagged)} se quedan sin tiempo` };
	return null;
}

/** Línea de estado bajo el tablero. */
export function statusText(chess: Chess, end: Outcome | null): string {
	if (end) {
		const head = end.winner ? `Ganan las ${colorName(end.winner)}` : 'Tablas';
		return `${head} · ${end.reason}`;
	}
	const turn = `Juegan las ${colorName(chess.turn())}`;
	return chess.inCheck() ? `${turn} · jaque` : turn;
}

/** Resultado en el formato del PGN: «1-0», «0-1», «1/2-1/2» o «*». */
export function resultTag(end: Outcome | null): string {
	if (!end) return '*';
	return end.winner === 'w' ? '1-0' : end.winner === 'b' ? '0-1' : '1/2-1/2';
}
