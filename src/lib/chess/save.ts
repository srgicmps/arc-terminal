// Guardado de la partida en curso de CHESS en este navegador (localStorage). Si el navegador no deja
// guardar (modo privado, cuota llena…) o lo guardado está roto, se empieza una partida nueva sin avisar.
import type { Clock } from './clock.ts';
import type { Color, Uci } from './game.ts';

const KEY = 'arc-chess';

export interface SavedGame {
	/** Jugadas desde la posición inicial, en UCI. */
	moves: Uci[];
	/** Bando que se ve abajo. */
	orientation: Color;
	clock: Clock | null;
	/** Bando que ha abandonado, o que se ha quedado sin tiempo. */
	resigned: Color | null;
	flagged: Color | null;
	/** Rival: un nivel del motor (LEVELS) o «human», dos personas en el mismo dispositivo. */
	rival: string;
	/** Bando del jugador cuando el rival es el motor. */
	human: Color;
}

export const emptyGame = (opts: Partial<Pick<SavedGame, 'clock' | 'rival' | 'human'>> = {}): SavedGame => {
	const human = opts.human ?? 'w';
	return {
		moves: [],
		orientation: human,
		clock: opts.clock ?? null,
		resigned: null,
		flagged: null,
		rival: opts.rival ?? 'club',
		human
	};
};

const isColor = (c: unknown): c is Color => c === 'w' || c === 'b';
const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

function parseClock(c: unknown): Clock | null {
	if (!c || typeof c !== 'object') return null;
	const o = c as Record<string, unknown>;
	if (![o.base, o.inc, o.w, o.b].every(isNum)) return null;
	// Al volver, el reloj está en pausa: el tiempo con la pestaña cerrada no cuenta.
	return { base: o.base as number, inc: o.inc as number, w: o.w as number, b: o.b as number, since: null };
}

/** Lee lo guardado y lo valida campo a campo. */
export function parseSaved(raw: string | null): SavedGame | null {
	if (!raw) return null;
	try {
		const o = JSON.parse(raw) as Record<string, unknown>;
		if (!o || !Array.isArray(o.moves)) return null;
		return {
			moves: o.moves.filter((m): m is string => typeof m === 'string' && /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(m)),
			orientation: isColor(o.orientation) ? o.orientation : 'w',
			clock: parseClock(o.clock),
			resigned: isColor(o.resigned) ? o.resigned : null,
			flagged: isColor(o.flagged) ? o.flagged : null,
			rival: typeof o.rival === 'string' ? o.rival : 'human',
			human: isColor(o.human) ? o.human : 'w'
		};
	} catch {
		return null;
	}
}

export function loadGame(): SavedGame | null {
	try {
		return parseSaved(localStorage.getItem(KEY));
	} catch {
		return null;
	}
}

export function saveGame(game: SavedGame) {
	try {
		localStorage.setItem(KEY, JSON.stringify(game));
	} catch {}
}

/** Problema del día ya resuelto en este navegador: se guarda su id. */
const SOLVED = 'arc-puzzle';

export function loadSolved(): string | null {
	try {
		return localStorage.getItem(SOLVED);
	} catch {
		return null;
	}
}

export function saveSolved(id: string) {
	try {
		localStorage.setItem(SOLVED, id);
	} catch {}
}
