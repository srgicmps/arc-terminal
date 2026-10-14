// Protocolo UCI, la forma de hablar con Stockfish, como funciones puras (se prueban con Vitest).
// El motor recibe órdenes de texto («position startpos moves e2e4», «go movetime 1000») y contesta con
// líneas como «info depth 12 score cp 31 pv e7e5 g1f3» y, al acabar, «bestmove e7e5».
import type { Color, Uci } from './game.ts';

/** Nivel del rival. Elo con UCI_LimitStrength, o null para la fuerza máxima. */
export interface Level {
	value: string;
	label: string;
	elo: number | null;
	/** Tiempo de pensar por jugada, en ms. */
	movetime: number;
}

export const LEVELS: Level[] = [
	{ value: 'beginner', label: 'Principiante ≈1350', elo: 1350, movetime: 500 },
	{ value: 'club', label: 'Club ≈1600', elo: 1600, movetime: 800 },
	{ value: 'strong', label: 'Fuerte ≈2000', elo: 2000, movetime: 1000 },
	{ value: 'master', label: 'Maestro ≈2400', elo: 2400, movetime: 1500 },
	{ value: 'max', label: 'Máximo', elo: null, movetime: 2000 }
];

/** La pista: la mejor jugada a toda fuerza, pensando 1 s. */
export const HINT: Level = { value: 'hint', label: 'Pista', elo: null, movetime: 1000 };

/** Valoración desde el lado de las blancas: centipeones (100 = un peón) o mate en N (negativo: pierden). */
export type Score = { cp: number } | { mate: number };

export interface Info {
	depth: number;
	/** Desde el lado de las blancas (UCI la da desde el lado del que mueve). */
	score: Score;
	pv: Uci[];
}

/** Órdenes para fijar la fuerza antes de una búsqueda. */
export function strengthCommands(level: Level): string[] {
	if (level.elo === null) return ['setoption name UCI_LimitStrength value false'];
	return ['setoption name UCI_LimitStrength value true', `setoption name UCI_Elo value ${level.elo}`];
}

export function positionCommand(moves: readonly Uci[]): string {
	return moves.length ? `position startpos moves ${moves.join(' ')}` : 'position startpos';
}

/** Lee una línea «info …» con valoración. Solo la variante principal (multipv 1); el resto, null. */
export function parseInfo(line: string, turn: Color): Info | null {
	if (!line.startsWith('info ') || !line.includes(' score ')) return null;
	const multipv = /\bmultipv (\d+)/.exec(line);
	if (multipv && multipv[1] !== '1') return null;
	// «lowerbound» y «upperbound» son valoraciones provisionales de mitad de búsqueda.
	if (/\b(lower|upper)bound\b/.test(line)) return null;
	const depth = Number(/\bdepth (\d+)/.exec(line)?.[1] ?? 0);
	const s = /\bscore (cp|mate) (-?\d+)/.exec(line);
	if (!s) return null;
	const sign = turn === 'w' ? 1 : -1;
	const value = Number(s[2]) * sign;
	const pv = /\bpv (.+)$/.exec(line)?.[1].trim().split(/\s+/) ?? [];
	return { depth, score: s[1] === 'cp' ? { cp: value } : { mate: value }, pv };
}

/** Lee «bestmove e2e4 ponder e7e5». «(none)» si no hay jugadas (mate o ahogado). */
export function parseBestMove(line: string): Uci | null | undefined {
	const m = /^bestmove (\S+)/.exec(line);
	if (!m) return undefined;
	return m[1] === '(none)' ? null : m[1];
}

/**
 * Valoración para la barra: de 0 (ganan negras) a 1 (ganan blancas), con 0,5 igualados. Curva logística
 * como la de Lichess: +1 peón ≈ 59 %, +3 ≈ 76 %; el mate llena la barra.
 */
export function scoreToBar(score: Score): number {
	if ('mate' in score) return score.mate > 0 ? 1 : score.mate < 0 ? 0 : 0.5;
	const cp = Math.max(-1000, Math.min(1000, score.cp));
	return 1 / (1 + Math.exp(-0.00368208 * cp));
}

/** «+0,4», «−1,2», «M3», «−M2». */
export function formatScore(score: Score): string {
	if ('mate' in score) return `${score.mate < 0 ? '−' : ''}M${Math.abs(score.mate)}`;
	const v = score.cp / 100;
	const text = Math.abs(v).toFixed(1).replace('.', ',');
	return v > 0.04 ? `+${text}` : v < -0.04 ? `−${text}` : '0,0';
}
