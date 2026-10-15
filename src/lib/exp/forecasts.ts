// Predicciones (experiencia 8): antes de cada dato macro (IPC, paro, tipos del BCE…) cada uno apuesta su
// previsión; cuando sale el dato, se puntúa. Aquí, sin Svelte ni red (Vitest):
// - RONDAS: las arma scripts/sources/forecasts.ts con el calendario de publicaciones y las reuniones del BCE.
//   Cada ronda recuerda el último dato conocido al abrirse (`base`) y se resuelve con el siguiente que sale.
// - PUNTOS, rachas y clasificación, con las apuestas de todos (cloud/forecasts.ts las guarda en D1).
import type { Point } from '../types.ts';

/** Qué se puede adivinar: el tema del calendario, su serie y cuánto error deja la ronda a 0 puntos. */
export interface Game {
	topic: string;
	series: string;
	label: string;
	/** Error (en puntos de la serie, que es un %) con el que ya no se suma nada. */
	scale: number;
	decimals: number;
	/** Tipos: el dato nuevo entra en la serie días después de la decisión; se mira a los `settleDays`. */
	settleDays?: number;
}

export const GAMES: Game[] = [
	{ topic: 'es-ipc', series: 'ipc-es', label: 'IPC de España', scale: 0.6, decimals: 1 },
	{ topic: 'us-cpi', series: 'cpi-us', label: 'IPC de EE. UU.', scale: 0.6, decimals: 1 },
	{ topic: 'ea-inflation', series: 'inflation-ea', label: 'Inflación de la zona euro', scale: 0.6, decimals: 1 },
	{ topic: 'us-jobs', series: 'unemployment-us', label: 'Paro de EE. UU.', scale: 0.4, decimals: 1 },
	{ topic: 'ea-unemployment', series: 'unemployment-es', label: 'Paro de España (Eurostat)', scale: 0.4, decimals: 1 },
	{ topic: 'ecb', series: 'ecb-dfr', label: 'Tipo de depósito del BCE', scale: 0.5, decimals: 2, settleDays: 8 }
];

export interface Round {
	/** «es-ipc@2026-10-30T08:00Z»: tema y cierre. El servidor lee el cierre del id (no acepta apuestas después). */
	id: string;
	topic: string;
	series: string;
	label: string;
	/** Periodo que se adivina («2026-10»), si se sabe. */
	period: string | null;
	/** Hasta cuándo se puede apostar: la hora de la publicación (ISO, al minuto). */
	closes: string;
	/** Último dato conocido al abrir la ronda. */
	base: Point;
	/** El dato que salió, cuando sale. */
	actual?: Point;
	scale: number;
	decimals: number;
}

export interface ForecastData {
	rounds: Round[];
}

export const ROUND_ID = /^[a-z0-9-]{2,24}@\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z$/;
export const roundId = (topic: string, closes: string) => `${topic}@${closes.slice(0, 16)}Z`;
/** El cierre de una ronda, sacado de su id (ms), o null si el id no vale. */
export function closesOf(id: string): number | null {
	if (!ROUND_ID.test(id)) return null;
	const t = Date.parse(id.split('@')[1].replace('Z', ':00Z'));
	return Number.isFinite(t) ? t : null;
}

/** El periodo siguiente: «2026-09» → «2026-10», «2026-Q2» → «2026-Q3». Null si no es mensual ni trimestral. */
export function nextPeriod(t: string): string | null {
	let m = /^(\d{4})-(\d{2})$/.exec(t);
	if (m) {
		const month = Number(m[2]) % 12 + 1;
		return `${Number(m[1]) + (month === 1 ? 1 : 0)}-${String(month).padStart(2, '0')}`;
	}
	m = /^(\d{4})-Q([1-4])$/.exec(t);
	if (m) return Number(m[2]) === 4 ? `${Number(m[1]) + 1}-Q1` : `${m[1]}-Q${Number(m[2]) + 1}`;
	return null;
}

const DAY = 86_400_000;

/**
 * Las rondas de esta pasada. Mantiene las de antes tal cual (su `base` no cambia), abre una por serie con la
 * próxima publicación (solo si no tiene ya una abierta), resuelve las que han cerrado y tiran las viejas.
 * `events`: [tema, cierre ISO] de las publicaciones (y reuniones) que vienen.
 */
export function updateRounds(
	previous: Round[],
	events: { topic: string; closes: string }[],
	series: Record<string, Point[]>,
	now: number,
	keepDays = 120
): Round[] {
	const out = previous.filter((r) => Date.parse(r.closes) > now - keepDays * DAY).map((r) => ({ ...r }));
	// Resolver.
	for (const r of out) {
		if (r.actual || Date.parse(r.closes) > now) continue;
		const game = GAMES.find((g) => g.topic === r.topic);
		const points = series[r.series];
		if (!game || !points?.length) continue;
		if (game.settleDays) {
			if (now < Date.parse(r.closes) + game.settleDays * DAY) continue;
			const day = new Date(Date.parse(r.closes) + game.settleDays * DAY).toISOString().slice(0, 10);
			const p = points.filter((x) => x.t <= day).at(-1);
			if (p) r.actual = p;
		} else {
			const p = points.find((x) => x.t > r.base.t);
			if (p) r.actual = p;
		}
	}
	// Abrir: una ronda abierta (sin resolver) por serie como mucho.
	for (const game of GAMES) {
		if (out.some((r) => r.series === game.series && !r.actual)) continue;
		const points = series[game.series];
		const base = points?.at(-1);
		if (!base) continue;
		const next = events
			.filter((e) => e.topic === game.topic && Date.parse(e.closes) > now + 60 * 60_000)
			.sort((a, b) => a.closes.localeCompare(b.closes))[0];
		if (!next) continue;
		const closes = `${next.closes.slice(0, 16)}Z`;
		out.push({
			id: roundId(game.topic, closes),
			topic: game.topic,
			series: game.series,
			label: game.label,
			period: game.settleDays ? null : nextPeriod(base.t),
			closes,
			base: { t: base.t, v: base.v },
			scale: game.scale,
			decimals: game.decimals
		});
	}
	return out.sort((a, b) => a.closes.localeCompare(b.closes));
}

// ---------- Puntos ----------

/** 100 si se clava; baja en línea recta hasta 0 cuando el error llega a la escala de la ronda. */
export function score(round: Pick<Round, 'scale' | 'actual'>, value: number): number | null {
	if (!round.actual) return null;
	const err = Math.abs(value - round.actual.v);
	return Math.max(0, Math.round(100 * (1 - err / round.scale)));
}

/** ¿La ha clavado? Igual al dato con los decimales con que se publica. */
export const exact = (round: Pick<Round, 'actual' | 'decimals'>, value: number) =>
	!!round.actual && value.toFixed(round.decimals) === round.actual.v.toFixed(round.decimals);

export interface Bet {
	/** Id aleatorio del jugador (nunca el email). */
	uid: string;
	alias: string | null;
	round: string;
	value: number;
}

export interface Standing {
	uid: string;
	alias: string;
	points: number;
	played: number;
	exact: number;
	/** Racha actual y mejor racha: rondas seguidas con 50 puntos o más. */
	streak: number;
	best: number;
}

export const nameOf = (b: Pick<Bet, 'uid' | 'alias'>) => b.alias || `Jugador ${b.uid.slice(0, 4).toUpperCase()}`;

/** La clasificación: por puntos, luego por clavadas y por menos rondas jugadas. */
export function standings(rounds: Round[], bets: Bet[]): Standing[] {
	const resolved = rounds.filter((r) => r.actual).sort((a, b) => a.closes.localeCompare(b.closes));
	const byUser = Map.groupBy(bets, (b) => b.uid);
	const out: Standing[] = [];
	for (const [uid, mine] of byUser) {
		const s: Standing = { uid, alias: nameOf(mine.at(-1)!), points: 0, played: 0, exact: 0, streak: 0, best: 0 };
		for (const r of resolved) {
			const bet = mine.find((b) => b.round === r.id);
			if (!bet) continue;
			const pts = score(r, bet.value)!;
			s.points += pts;
			s.played++;
			if (exact(r, bet.value)) s.exact++;
			s.streak = pts >= 50 ? s.streak + 1 : 0;
			s.best = Math.max(s.best, s.streak);
		}
		if (s.played) out.push(s);
	}
	return out.sort((a, b) => b.points - a.points || b.exact - a.exact || a.played - b.played || a.alias.localeCompare(b.alias));
}

/** «Consenso de Arc»: la mediana de las apuestas de una ronda (cerrada), o null. */
export function median(values: number[]): number | null {
	if (!values.length) return null;
	const v = [...values].sort((a, b) => a - b);
	const mid = Math.floor(v.length / 2);
	return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}
