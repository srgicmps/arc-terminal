import { describe, expect, it } from 'vitest';
import { toMatch, toRace, toTable } from '../sources/sports.ts';
import { nextRaces, results, sportsSentence, upcoming } from '../../src/lib/sports.ts';

const raw = (over: object) => ({
	utcDate: '2026-10-18T19:00:00Z',
	status: 'TIMED',
	matchday: 9,
	stage: 'REGULAR_SEASON',
	homeTeam: { name: 'Real Madrid CF', shortName: 'Real Madrid', tla: 'RMA' },
	awayTeam: { name: 'FC Barcelona', shortName: 'Barça', tla: 'FCB' },
	score: { fullTime: { home: null, away: null } },
	...over
});

describe('football-data', () => {
	it('convierte partidos de liga y de Champions', () => {
		expect(toMatch(raw({}))).toMatchObject({ round: 'Jornada 9', home: 'Real Madrid', away: 'Barça', homeGoals: null });
		expect(toMatch(raw({ stage: 'LEAGUE_STAGE', matchday: 3 })).round).toBe('Fase liga · J3');
		expect(toMatch(raw({ stage: 'QUARTER_FINALS' })).round).toBe('Cuartos');
	});
	it('se queda con la tabla total', () => {
		const table = toTable({
			standings: [
				{ type: 'TOTAL', table: [{ position: 1, team: { shortName: 'Barça', tla: 'FCB' }, playedGames: 9, won: 7, draw: 1, lost: 1, goalDifference: 15, points: 22 }] },
				{ type: 'HOME', table: [{ position: 1, team: { shortName: 'X' }, playedGames: 1, won: 1, draw: 0, lost: 0, goalDifference: 1, points: 3 }] }
			]
		});
		expect(table).toEqual([{ pos: 1, team: 'Barça', tla: 'FCB', played: 9, won: 7, draw: 1, lost: 1, gd: 15, points: 22 }]);
	});
});

describe('ordenar partidos y carreras', () => {
	const now = Date.parse('2026-10-15T12:00:00Z');
	const m = (date: string, status: string) => ({ date, status, round: '', home: 'A', away: 'B', homeGoals: null, awayGoals: null });
	const list = [m('2026-10-12T19:00:00Z', 'FINISHED'), m('2026-10-14T19:00:00Z', 'FINISHED'), m('2026-10-18T19:00:00Z', 'TIMED'), m('2026-10-16T19:00:00Z', 'SCHEDULED'), m('2026-10-17T19:00:00Z', 'POSTPONED')];
	it('resultados del más nuevo al más viejo y próximos del más cercano', () => {
		expect(results(list).map((x) => x.date.slice(8, 10))).toEqual(['14', '12']);
		expect(upcoming(list, now).map((x) => x.date.slice(8, 10))).toEqual(['16', '18']);
	});
	it('carreras que faltan', () => {
		const r = (date: string) => toRace({ round: '1', raceName: 'Mexico City Grand Prix', date, Circuit: { circuitName: 'Hermanos Rodríguez', Location: { country: 'Mexico' } } });
		expect(r('2026-10-25').name).toBe('Mexico City');
		expect(nextRaces([r('2026-10-11'), r('2026-10-25')], now).map((x) => x.date)).toEqual(['2026-10-25']);
	});
});

describe('sportsSentence', () => {
	it('dice quién lidera', () => {
		const row = (team: string, points: number) => ({ pos: 1, team, tla: '', played: 9, won: 0, draw: 0, lost: 0, gd: 0, points });
		const football = { competitions: [{ code: 'PD', name: 'LaLiga', table: [row('Barça', 22), row('Real Madrid', 19)], matches: [] }] };
		const driver = (name: string, points: number) => ({ pos: 1, name, code: '', team: '', points, wins: 0 });
		const f1 = { season: '2026', round: 17, drivers: [driver('Andrea Kimi Antonelli', 340), driver('George Russell', 238)], teams: [], last: null, next: [] };
		expect(sportsSentence(football, f1)).toBe('Barça lidera LaLiga con 22 puntos, 3 más que el Real Madrid. Andrea Kimi Antonelli manda en la F1 con 340 puntos, 102 más que George Russell.');
		expect(sportsSentence(null, null)).toBe('');
	});
});
