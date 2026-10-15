import { describe, expect, it } from 'vitest';
import { closesOf, exact, median, nextPeriod, roundId, score, standings, updateRounds, type Bet, type Round } from './forecasts.ts';

const NOW = Date.parse('2026-10-15T10:00:00Z');

describe('predicciones', () => {
	it('periodos y ids', () => {
		expect(nextPeriod('2026-09')).toBe('2026-10');
		expect(nextPeriod('2026-12')).toBe('2027-01');
		expect(nextPeriod('2026-Q4')).toBe('2027-Q1');
		expect(nextPeriod('2026-10-14')).toBeNull();
		const id = roundId('es-ipc', '2026-10-30T08:00:00.000Z');
		expect(id).toBe('es-ipc@2026-10-30T08:00Z');
		expect(closesOf(id)).toBe(Date.parse('2026-10-30T08:00:00Z'));
		expect(closesOf('raro')).toBeNull();
		expect(closesOf('x@2026-10-30')).toBeNull();
	});

	it('abre una ronda por serie con la próxima publicación y la resuelve con el dato siguiente', () => {
		const series = { 'ipc-es': [{ t: '2026-08', v: 2.7 }, { t: '2026-09', v: 2.9 }] };
		const events = [
			{ topic: 'es-ipc', closes: '2026-11-13T08:00:00Z' },
			{ topic: 'es-ipc', closes: '2026-10-30T08:00:00Z' },
			{ topic: 'otro', closes: '2026-10-20T08:00:00Z' }
		];
		const open = updateRounds([], events, series, NOW);
		expect(open).toHaveLength(1);
		expect(open[0]).toMatchObject({ id: 'es-ipc@2026-10-30T08:00Z', period: '2026-10', base: { t: '2026-09', v: 2.9 } });
		// Otra pasada antes de que salga: no abre otra ni cambia la base.
		expect(updateRounds(open, events, { 'ipc-es': [...series['ipc-es'], { t: '2026-09', v: 3 }] }, NOW)).toEqual(open);
		// Cierra, pero el dato aún no ha salido.
		const after = Date.parse('2026-10-30T09:00:00Z');
		expect(updateRounds(open, events, series, after)[0].actual).toBeUndefined();
		// Sale el dato: se resuelve y se abre la siguiente.
		const done = updateRounds(open, events, { 'ipc-es': [...series['ipc-es'], { t: '2026-10', v: 3.1 }] }, after);
		expect(done[0].actual).toEqual({ t: '2026-10', v: 3.1 });
		expect(done[1]).toMatchObject({ id: 'es-ipc@2026-11-13T08:00Z', period: '2026-11', base: { t: '2026-10', v: 3.1 } });
	});

	it('los tipos del BCE se miran unos días después de la reunión', () => {
		const series = { 'ecb-dfr': [{ t: '2026-10-01', v: 2 }] };
		const [r] = updateRounds([], [{ topic: 'ecb', closes: '2026-10-29T12:15:00Z' }], series, NOW);
		expect(r.period).toBeNull();
		const later = { 'ecb-dfr': [...series['ecb-dfr'], { t: '2026-11-05', v: 1.75 }, { t: '2026-11-20', v: 1.5 }] };
		expect(updateRounds([r], [], later, Date.parse('2026-11-01T00:00:00Z'))[0].actual).toBeUndefined();
		expect(updateRounds([r], [], later, Date.parse('2026-11-07T00:00:00Z'))[0].actual).toEqual({ t: '2026-11-05', v: 1.75 });
	});

	it('puntúa, cuenta clavadas, rachas y ordena la clasificación', () => {
		const r = (id: string, v: number, closes: string): Round =>
			({ id, closes, actual: { t: 'x', v }, scale: 0.6, decimals: 1 }) as Round;
		const rounds = [r('a', 3, '2026-01-01'), r('b', 2, '2026-02-01'), r('c', 1, '2026-03-01'), { ...r('d', 0, '2026-04-01'), actual: undefined }];
		expect(score(rounds[0], 3)).toBe(100);
		expect(score(rounds[0], 3.3)).toBe(50);
		expect(score(rounds[0], 4)).toBe(0);
		expect(score(rounds[3], 1)).toBeNull();
		expect(exact(rounds[0], 3.04)).toBe(true);
		const bets: Bet[] = [
			{ uid: 'u1', alias: 'Ana', round: 'a', value: 3 },
			{ uid: 'u1', alias: 'Ana', round: 'b', value: 3 },
			{ uid: 'u1', alias: 'Ana', round: 'c', value: 1 },
			{ uid: 'u2', alias: null, round: 'a', value: 3.1 },
			{ uid: 'u2', alias: null, round: 'b', value: 2.1 },
			{ uid: 'u2', alias: null, round: 'c', value: 1.1 },
			{ uid: 'u3', alias: 'Nadie', round: 'd', value: 1 }
		];
		const s = standings(rounds, bets);
		expect(s.map((x) => [x.alias, x.points, x.exact, x.streak, x.best])).toEqual([
			['Jugador U2', 249, 0, 3, 3],
			['Ana', 200, 2, 1, 1]
		]);
	});

	it('mediana', () => {
		expect(median([3, 1, 2])).toBe(2);
		expect(median([1, 2, 3, 4])).toBe(2.5);
		expect(median([])).toBeNull();
	});
});
