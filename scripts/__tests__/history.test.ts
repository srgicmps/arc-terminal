import { describe, expect, it } from 'vitest';
import type { SourceStatus, StatePoint } from '../../src/lib/data.ts';
import { appendHistory, minute, withHistory } from '../history.ts';

const NOW = Date.parse('2026-10-14T12:07:31.500Z');
const DAY = 86_400_000;
const at = (ms: number, state: StatePoint['state'] = 'ok'): StatePoint => ({ t: minute(ms), state });

describe('minute', () => {
	it('recorta la hora al minuto', () => {
		expect(minute(NOW)).toBe('2026-10-14T12:07Z');
		expect(Date.parse(minute(NOW))).toBe(Date.parse('2026-10-14T12:07:00Z'));
	});
});

describe('appendHistory', () => {
	it('empieza un historial nuevo', () => {
		expect(appendHistory(undefined, at(NOW), NOW)).toEqual([at(NOW)]);
		expect(appendHistory([], at(NOW, 'stale'), NOW)).toEqual([at(NOW, 'stale')]);
	});

	it('añade al final y conserva lo de los últimos 7 días', () => {
		const old = [at(NOW - 2 * DAY, 'error'), at(NOW - DAY, 'cached')];
		expect(appendHistory(old, at(NOW), NOW)).toEqual([...old, at(NOW)]);
	});

	it('descarta lo que tiene más de 7 días, pero no lo que tiene justo 7', () => {
		const edge = { t: new Date(NOW - 7 * DAY).toISOString(), state: 'ok' as const };
		const tooOld = at(NOW - 8 * DAY, 'error');
		const result = appendHistory([tooOld, edge], at(NOW), NOW);
		expect(result).toEqual([edge, at(NOW)]);
	});

	it('admite otro número de días', () => {
		const result = appendHistory([at(NOW - 2 * DAY), at(NOW - DAY / 2)], at(NOW), NOW, 1);
		expect(result).toEqual([at(NOW - DAY / 2), at(NOW)]);
	});

	it('ignora puntos rotos o un historial que no es una lista', () => {
		const broken = [{ t: 'ayer', state: 'ok' }, null, { state: 'ok' }] as unknown as StatePoint[];
		expect(appendHistory(broken, at(NOW), NOW)).toEqual([at(NOW)]);
		expect(appendHistory('basura' as unknown as StatePoint[], at(NOW), NOW)).toEqual([at(NOW)]);
	});

	it('no repite el mismo minuto: se queda el estado de ahora', () => {
		expect(appendHistory([at(NOW, 'error')], at(NOW, 'ok'), NOW)).toEqual([at(NOW, 'ok')]);
	});

	it('ordena de la más antigua a la más reciente', () => {
		const result = appendHistory([at(NOW - 1000 * 60 * 15), at(NOW - DAY)], at(NOW), NOW);
		expect(result.map((p) => p.t)).toEqual([minute(NOW - DAY), minute(NOW - 1000 * 60 * 15), minute(NOW)]);
	});

	it('no modifica la lista anterior', () => {
		const old = [at(NOW - DAY)];
		appendHistory(old, at(NOW), NOW);
		expect(old).toHaveLength(1);
	});
});

describe('withHistory', () => {
	const status = (name: string, state: SourceStatus['state'], history?: StatePoint[]): SourceStatus => ({
		name,
		label: name,
		state,
		fetchedAt: null,
		...(history ? { history } : {})
	});

	it('une cada fuente con su historial publicado por nombre', () => {
		const before = [status('fuel', 'ok', [at(NOW - DAY, 'error')]), status('boe', 'ok', [at(NOW - DAY)])];
		const [fuel, boe] = withHistory([status('fuel', 'stale'), status('boe', 'cached')], before, NOW);
		expect(fuel.history).toEqual([at(NOW - DAY, 'error'), at(NOW, 'stale')]);
		expect(boe.history).toEqual([at(NOW - DAY), at(NOW, 'cached')]);
	});

	it('las fuentes nuevas empiezan con un punto y las retiradas desaparecen', () => {
		const before = [status('vieja', 'ok', [at(NOW - DAY)])];
		const result = withHistory([status('nueva', 'off')], before, NOW);
		expect(result).toEqual([{ ...status('nueva', 'off'), history: [at(NOW, 'off')] }]);
	});

	it('funciona sin status anterior o con uno sin historial', () => {
		expect(withHistory([status('a', 'ok')], null, NOW)[0].history).toEqual([at(NOW)]);
		expect(withHistory([status('a', 'ok')], [status('a', 'error')], NOW)[0].history).toEqual([at(NOW)]);
		expect(withHistory([status('a', 'ok')], {} as unknown as SourceStatus[], NOW)[0].history).toEqual([at(NOW)]);
	});
});
