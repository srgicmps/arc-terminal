// DEP (F20): fútbol (football-data.org) y Fórmula 1 (Jolpica). Tipos compartidos por la fuente
// (scripts/sources/sports.ts) y la vista, y funciones puras para ordenar partidos.

export interface StandingRow {
	pos: number;
	team: string;
	/** Siglas de tres letras (football-data: «RMA»). */
	tla: string;
	played: number;
	won: number;
	draw: number;
	lost: number;
	gd: number;
	points: number;
}

export interface Match {
	/** ISO 8601 en UTC. */
	date: string;
	/** SCHEDULED, TIMED, IN_PLAY, PAUSED, FINISHED, POSTPONED… (football-data). */
	status: string;
	/** «Jornada 9» o la fase («Octavos»). */
	round: string;
	home: string;
	away: string;
	homeGoals: number | null;
	awayGoals: number | null;
}

export interface Competition {
	/** PD (LaLiga), CL (Champions). */
	code: string;
	name: string;
	table: StandingRow[];
	matches: Match[];
}

export interface FootballData {
	competitions: Competition[];
}

export interface DriverRow {
	pos: number;
	name: string;
	code: string;
	team: string;
	points: number;
	wins: number;
}

export interface TeamRow {
	pos: number;
	team: string;
	points: number;
	wins: number;
}

export interface RaceResult {
	pos: number;
	name: string;
	team: string;
	/** «1:42:00.785», «+7.335» o el motivo de abandono. */
	time: string;
	points: number;
}

export interface Race {
	round: number;
	name: string;
	circuit: string;
	country: string;
	/** ISO 8601 (fecha y, si la hay, hora de salida en UTC). */
	date: string;
}

export interface F1Data {
	season: string;
	round: number;
	drivers: DriverRow[];
	teams: TeamRow[];
	last: (Race & { results: RaceResult[] }) | null;
	next: Race[];
}

const LIVE = new Set(['IN_PLAY', 'PAUSED', 'LIVE']);
const DONE = new Set(['FINISHED', 'AWARDED']);

export const isLive = (m: Match) => LIVE.has(m.status);
export const isDone = (m: Match) => DONE.has(m.status);

/** Los resultados más recientes (o en juego), del más nuevo al más viejo. */
export function results(matches: Match[], n = 10): Match[] {
	return matches
		.filter((m) => isDone(m) || isLive(m))
		.sort((a, b) => b.date.localeCompare(a.date))
		.slice(0, n);
}

/** Los próximos partidos (desde `now`), del más cercano al más lejano. Aplazados y cancelados, fuera. */
export function upcoming(matches: Match[], now: number, n = 10): Match[] {
	return matches
		.filter((m) => !isDone(m) && !isLive(m) && !['POSTPONED', 'CANCELLED', 'SUSPENDED'].includes(m.status) && Date.parse(m.date) >= now - 3 * 3_600_000)
		.sort((a, b) => a.date.localeCompare(b.date))
		.slice(0, n);
}

/** Las carreras que faltan (desde `now`, con margen de un día para la que se corre hoy). */
export function nextRaces(races: Race[], now: number, n = 5): Race[] {
	return races.filter((r) => Date.parse(r.date) >= now - 86_400_000).slice(0, n);
}

/** Frase para el modo Sencillo: quién lidera LaLiga y el Mundial de F1. */
export function sportsSentence(football: FootballData | null | undefined, f1: F1Data | null | undefined): string {
	const parts: string[] = [];
	const liga = football?.competitions.find((c) => c.code === 'PD')?.table;
	if (liga && liga.length >= 2) parts.push(`${liga[0].team} lidera LaLiga con ${liga[0].points} puntos, ${liga[0].points - liga[1].points} más que el ${liga[1].team}`);
	const d = f1?.drivers;
	if (d && d.length >= 2) parts.push(`${d[0].name} manda en la F1 con ${d[0].points} puntos, ${d[0].points - d[1].points} más que ${d[1].name}`);
	return parts.length ? parts.join('. ') + '.' : '';
}
