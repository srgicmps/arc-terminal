// DEP (F20): fútbol y Fórmula 1.
//
// · Fútbol: football-data.org v4 (https://www.football-data.org/documentation/quickstart). Plan gratuito
//   con registro y solo para uso no comercial: 10 peticiones por minuto, LaLiga (PD) y Champions (CL)
//   incluidas. El token va en la cabecera X-Auth-Token (Secret FOOTBALL_DATA_TOKEN); sin él, la fuente se
//   salta. Cuatro peticiones por pasada (tabla y partidos de cada competición), cada 30 min.
// · F1: Jolpica (https://github.com/jolpica/jolpica-f1), la sucesora de Ergast, sin clave. Datos con licencia
//   CC BY-NC-SA 4.0 (no comercial, citando la fuente). Proyecto de voluntarios: cuatro peticiones cada 3 h.
import type { Competition, F1Data, FootballData, Match, Race, StandingRow } from '../../src/lib/sports.ts';
import { getJson, type Source } from '../lib.ts';

const FD = 'https://api.football-data.org/v4';
const FD_KEY = 'FOOTBALL_DATA_TOKEN';
const COMPETITIONS: { code: string; name: string }[] = [
	{ code: 'PD', name: 'LaLiga' },
	{ code: 'CL', name: 'Champions League' }
];

const STAGES: Record<string, string> = {
	LEAGUE_STAGE: 'Fase liga',
	PLAYOFFS: 'Eliminatoria',
	LAST_16: 'Octavos',
	QUARTER_FINALS: 'Cuartos',
	SEMI_FINALS: 'Semifinales',
	FINAL: 'Final',
	GROUP_STAGE: 'Fase de grupos'
};

interface RawTeam {
	name?: string | null;
	shortName?: string | null;
	tla?: string | null;
}

interface RawMatch {
	utcDate: string;
	status: string;
	matchday?: number | null;
	stage?: string | null;
	homeTeam: RawTeam;
	awayTeam: RawTeam;
	score?: { fullTime?: { home: number | null; away: number | null } };
}

interface RawStandings {
	standings?: { type: string; table: { position: number; team: RawTeam; playedGames: number; won: number; draw: number; lost: number; goalDifference: number; points: number }[] }[];
}

const team = (t: RawTeam) => t.shortName || t.name || '—';

export function toMatch(m: RawMatch): Match {
	const stage = STAGES[m.stage ?? ''] ?? '';
	let round = stage;
	if (!m.stage || m.stage === 'REGULAR_SEASON') round = m.matchday ? `Jornada ${m.matchday}` : '';
	else if (m.stage === 'LEAGUE_STAGE' && m.matchday) round = `${stage} · J${m.matchday}`;
	return {
		date: m.utcDate,
		status: m.status,
		round,
		home: team(m.homeTeam),
		away: team(m.awayTeam),
		homeGoals: m.score?.fullTime?.home ?? null,
		awayGoals: m.score?.fullTime?.away ?? null
	};
}

/** La tabla total (en Champions, la de la fase liga; si hay grupos, se juntan por orden). */
export function toTable(raw: RawStandings): StandingRow[] {
	const totals = (raw.standings ?? []).filter((s) => s.type === 'TOTAL');
	return totals.flatMap((s) =>
		s.table.map((r) => ({
			pos: r.position,
			team: team(r.team),
			tla: r.team.tla ?? '',
			played: r.playedGames,
			won: r.won,
			draw: r.draw,
			lost: r.lost,
			gd: r.goalDifference,
			points: r.points
		}))
	);
}

const day = (t: number) => new Date(t).toISOString().slice(0, 10);

export const football: Source<FootballData> = {
	name: 'football',
	label: 'LaLiga y Champions: clasificación y partidos · football-data.org',
	maxAgeMinutes: 30,
	requires: FD_KEY,
	async fetch() {
		const headers = { 'X-Auth-Token': process.env[FD_KEY] ?? '' };
		const now = Date.now();
		// Dos semanas atrás y tres adelante: los últimos resultados y la próxima jornada (con parones).
		const range = `dateFrom=${day(now - 14 * 86_400_000)}&dateTo=${day(now + 21 * 86_400_000)}`;
		const competitions: Competition[] = [];
		for (const c of COMPETITIONS) {
			const [standings, matches] = await Promise.all([
				getJson<RawStandings>(`${FD}/competitions/${c.code}/standings`, { headers }),
				getJson<{ matches?: RawMatch[] }>(`${FD}/competitions/${c.code}/matches?${range}`, { headers })
			]);
			competitions.push({ ...c, table: toTable(standings), matches: (matches.matches ?? []).map(toMatch) });
		}
		if (!competitions.some((c) => c.table.length || c.matches.length)) throw new Error('football-data no ha devuelto ni tablas ni partidos');
		return { competitions };
	}
};

// ---------- F1 (Jolpica) ----------

const JOLPICA = 'https://api.jolpi.ca/ergast/f1/current';

interface RawDriver {
	code?: string;
	givenName: string;
	familyName: string;
}
interface RawConstructor {
	name: string;
}
interface RawRace {
	round: string;
	raceName: string;
	date: string;
	time?: string;
	Circuit: { circuitName: string; Location: { country: string } };
	Results?: { position: string; points: string; status: string; Time?: { time: string }; Driver: RawDriver; Constructor: RawConstructor }[];
}
type MR<T> = { MRData: T };

const n = (s: string | undefined) => Number(s ?? 0) || 0;
const driverName = (d: RawDriver) => `${d.givenName} ${d.familyName}`;

export function toRace(r: RawRace): Race {
	return {
		round: n(r.round),
		name: r.raceName.replace(/ Grand Prix$/, ''),
		circuit: r.Circuit.circuitName,
		country: r.Circuit.Location.country,
		date: r.time ? `${r.date}T${r.time}` : r.date
	};
}

export const f1: Source<F1Data> = {
	name: 'f1',
	label: 'Fórmula 1: mundial, última carrera y calendario · Jolpica (CC BY-NC-SA 4.0)',
	maxAgeMinutes: 180,
	async fetch() {
		const [drivers, teams, last, races] = await Promise.all([
			getJson<MR<{ StandingsTable: { season: string; round: string; StandingsLists: { DriverStandings: { position: string; points: string; wins: string; Driver: RawDriver; Constructors: RawConstructor[] }[] }[] } }>>(`${JOLPICA}/driverstandings.json`),
			getJson<MR<{ StandingsTable: { StandingsLists: { ConstructorStandings: { position: string; points: string; wins: string; Constructor: RawConstructor }[] }[] } }>>(`${JOLPICA}/constructorstandings.json`),
			getJson<MR<{ RaceTable: { Races: RawRace[] } }>>(`${JOLPICA}/last/results.json`),
			getJson<MR<{ RaceTable: { Races: RawRace[] } }>>(`${JOLPICA}/races.json`)
		]);
		const table = drivers.MRData.StandingsTable;
		const lastRace = last.MRData.RaceTable.Races[0];
		const now = Date.now();
		const data: F1Data = {
			season: table.season,
			round: n(table.round),
			drivers: (table.StandingsLists[0]?.DriverStandings ?? []).map((d) => ({
				pos: n(d.position),
				name: driverName(d.Driver),
				code: d.Driver.code ?? '',
				team: d.Constructors.at(-1)?.name ?? '',
				points: n(d.points),
				wins: n(d.wins)
			})),
			teams: (teams.MRData.StandingsTable.StandingsLists[0]?.ConstructorStandings ?? []).map((t) => ({
				pos: n(t.position),
				team: t.Constructor.name,
				points: n(t.points),
				wins: n(t.wins)
			})),
			last: lastRace
				? {
						...toRace(lastRace),
						results: (lastRace.Results ?? []).slice(0, 10).map((r) => ({
							pos: n(r.position),
							name: driverName(r.Driver),
							team: r.Constructor.name,
							time: r.Time?.time ?? r.status,
							points: n(r.points)
						}))
					}
				: null,
			next: races.MRData.RaceTable.Races.map(toRace).filter((r) => Date.parse(r.date) >= now - 86_400_000)
		};
		if (!data.drivers.length && !data.next.length) throw new Error('Jolpica no ha devuelto clasificación ni calendario');
		return data;
	}
};
