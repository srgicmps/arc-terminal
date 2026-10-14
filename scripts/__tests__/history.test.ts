import { describe, expect, it } from 'vitest';
import { lastRuns, type SourceStatus, type StateSpan } from '../../src/lib/data.ts';
import { appendSpan, minute, withHistory } from '../history.ts';

const NOW = Date.parse('2026-10-14T12:07:31.500Z');
const DAY = 86_400_000;
const span = (ms: number, state: StateSpan['state'], runs = 1): StateSpan => ({ t: minute(ms), state, runs });

describe('minute', () => {
	it('recorta la hora al minuto', () => {
		expect(minute(NOW)).toBe('2026-10-14T12:07Z');
		expect(Date.parse(minute(NOW))).toBe(Date.parse('2026-10-14T12:07:00Z'));
	});
});

describe('appendSpan', () => {
	it('empieza un historial nuevo con un tramo', () => {
		expect(appendSpan(undefined, 'ok', NOW)).toEqual([span(NOW, 'ok')]);
		expect(appendSpan([], 'stale', NOW)).toEqual([span(NOW, 'stale')]);
	});

	it('suma una pasada al último tramo si el estado no cambia', () => {
		const old = [span(NOW - DAY, 'error', 2), span(NOW - 3600_000, 'ok', 4)];
		expect(appendSpan(old, 'ok', NOW)).toEqual([old[0], { ...old[1], runs: 5 }]);
	});

	it('abre un tramo nuevo cuando cambia el estado', () => {
		const old = [span(NOW - DAY, 'ok', 90)];
		expect(appendSpan(old, 'error', NOW)).toEqual([...old, span(NOW, 'error')]);
	});

	it('cached y ok son tramos distintos', () => {
		expect(appendSpan([span(NOW - DAY, 'ok', 3)], 'cached', NOW)).toHaveLength(2);
	});

	it('descarta los tramos que acabaron hace más de 7 días', () => {
		const old = [span(NOW - 10 * DAY, 'error'), span(NOW - 8 * DAY, 'ok', 50), span(NOW - 6 * DAY, 'stale')];
		// El tramo «error» acabó hace 8 días (fuera); el «ok» acabó hace 6 (dentro, aunque empezó antes).
		expect(appendSpan(old, 'stale', NOW)).toEqual([old[1], { ...old[2], runs: 2 }]);
	});

	it('el último tramo se queda aunque sea antiguo', () => {
		const old = [span(NOW - 30 * DAY, 'ok', 2000)];
		expect(appendSpan(old, 'ok', NOW)).toEqual([{ ...old[0], runs: 2001 }]);
	});

	it('admite otro número de días', () => {
		const old = [span(NOW - 3 * DAY, 'ok'), span(NOW - 2 * DAY, 'error'), span(NOW - DAY / 2, 'ok')];
		// Con 1 día: el «ok» acabó hace 2 días (fuera); el «error», hace medio día (dentro).
		expect(appendSpan(old, 'ok', NOW, 1)).toEqual([old[1], { ...old[2], runs: 2 }]);
	});

	it('ignora tramos rotos o un historial que no es una lista', () => {
		const broken = [{ t: 'ayer', state: 'ok', runs: 3 }, null, { t: minute(NOW), state: 'ok', runs: 0 }];
		expect(appendSpan(broken as unknown as StateSpan[], 'ok', NOW)).toEqual([span(NOW, 'ok')]);
		expect(appendSpan('basura' as unknown as StateSpan[], 'ok', NOW)).toEqual([span(NOW, 'ok')]);
	});

	it('no modifica la lista anterior', () => {
		const old = [span(NOW - DAY, 'ok', 1)];
		appendSpan(old, 'ok', NOW);
		expect(old).toEqual([span(NOW - DAY, 'ok', 1)]);
	});
});

describe('withHistory', () => {
	const status = (name: string, state: SourceStatus['state']): SourceStatus => ({
		name,
		label: name,
		state,
		fetchedAt: null
	});

	it('une cada fuente con su historial publicado por nombre y anota la pasada', () => {
		const before = [
			{ name: 'fuel', lastRun: minute(NOW - 900_000), history: [span(NOW - DAY, 'error', 3)] },
			{ name: 'boe', lastRun: minute(NOW - 900_000), history: [span(NOW - DAY, 'cached', 7)] }
		];
		const [fuel, boe] = withHistory([status('fuel', 'stale'), status('boe', 'cached')], before, NOW);
		expect(fuel).toEqual({ name: 'fuel', lastRun: minute(NOW), history: [span(NOW - DAY, 'error', 3), span(NOW, 'stale')] });
		expect(boe.history).toEqual([span(NOW - DAY, 'cached', 8)]);
	});

	it('las fuentes nuevas empiezan con un tramo y las retiradas desaparecen', () => {
		const before = [{ name: 'vieja', lastRun: minute(NOW), history: [span(NOW - DAY, 'ok')] }];
		expect(withHistory([status('nueva', 'off')], before, NOW)).toEqual([
			{ name: 'nueva', lastRun: minute(NOW), history: [span(NOW, 'off')] }
		]);
	});

	it('funciona sin historial anterior o con uno roto', () => {
		expect(withHistory([status('a', 'ok')], null, NOW)[0].history).toEqual([span(NOW, 'ok')]);
		expect(withHistory([status('a', 'ok')], {} as never, NOW)[0].history).toEqual([span(NOW, 'ok')]);
		expect(withHistory([status('a', 'ok')], [null] as never, NOW)[0].history).toEqual([span(NOW, 'ok')]);
	});
});

describe('lastRuns', () => {
	const spans = [span(NOW - 3 * DAY, 'ok', 3), span(NOW - 2 * DAY, 'error', 2), span(NOW - DAY, 'cached', 1)];

	it('despliega los tramos en pasadas, de la más antigua a la más reciente', () => {
		expect(lastRuns(spans, 28)).toEqual(['ok', 'ok', 'ok', 'error', 'error', 'cached']);
	});

	it('se queda con las últimas n', () => {
		expect(lastRuns(spans, 4)).toEqual(['ok', 'error', 'error', 'cached']);
		expect(lastRuns([span(NOW, 'ok', 500)], 28)).toHaveLength(28);
	});

	it('sin tramos o con contadores rotos, nada', () => {
		expect(lastRuns(undefined, 28)).toEqual([]);
		expect(lastRuns([], 28)).toEqual([]);
		expect(lastRuns([{ t: minute(NOW), state: 'ok', runs: Number.NaN }], 28)).toEqual([]);
		expect(lastRuns(spans, 0)).toEqual([]);
	});
});
