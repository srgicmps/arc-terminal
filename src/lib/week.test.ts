import { describe, expect, it } from 'vitest';
import { dailySeries, weekSummary } from './week.ts';
import type { ImpData, ImpEntry, ReleaseEvent, Series } from './types.ts';

const e = (k: string, score: number): ImpEntry => ({ k, title: k.toUpperCase(), url: `https://x.example/${k}`, sources: ['A'], score });
const imp: ImpData = {
	date: '2026-10-14',
	current: [],
	days: [
		{ date: '2026-10-01', items: [e('viejo', 50)] },
		{ date: '2026-10-09', items: [e('a', 4)] },
		{ date: '2026-10-13', items: [e('a', 5), e('b', 6)] }
	],
	seen: []
};
const daily = (id: string, pts: [string, number][]): Series => ({ id, label: id, unit: '', source: 'FRED', points: pts.map(([t, v]) => ({ t, v })) });
const ev = (date: string, title: string): ReleaseEvent => ({ date, allDay: false, title, source: 'INE', topic: 'ipc' });
const now = new Date('2026-10-14T12:00:00Z');

describe('weekSummary', () => {
	const w = weekSummary({
		imp,
		now,
		markets: [
			{ label: 'WTI', series: daily('wti', [['2026-10-06', 80], ['2026-10-07', 75], ['2026-10-14', 78]]), kind: 'pct' },
			{ label: '10 años', series: daily('t10', [['2026-10-07', 4.1], ['2026-10-14', 4.25]]), kind: 'pb' },
			{ label: 'Sin datos', series: undefined, kind: 'pct' }
		],
		releases: {
			past: [ev('2026-10-05T07:00:00Z', 'vieja'), ev('2026-10-10T07:00:00Z', 'IPC')],
			events: [ev('2026-10-10T07:00:00Z', 'IPC'), ev('2026-10-14T07:00:00Z', 'EPA'), ev('2026-10-16T12:30:00Z', 'CPI'), ev('2026-10-30T07:00:00Z', 'lejos')]
		}
	});

	it('top de IMP sumado en 7 días', () => {
		expect(w.top.map((t) => [t.k, t.score])).toEqual([['a', 9], ['b', 6]]);
	});

	it('mercados: % para precios, puntos básicos para tipos, y fuera los que no tienen serie', () => {
		expect(w.markets.map((m) => [m.label, m.last, m.change && Math.round(m.change * 100) / 100])).toEqual([
			['WTI', 78, 4],
			['10 años', 4.25, 15]
		]);
	});

	it('datos de la semana (lo más reciente primero, sin repetir) y agenda de 7 días', () => {
		expect(w.macro.map((x) => x.title)).toEqual(['EPA', 'IPC']);
		expect(w.agenda.map((x) => x.title)).toEqual(['CPI']);
	});

	it('sin datos, todo vacío', () => {
		expect(weekSummary({ imp: null, markets: [], releases: null, now })).toEqual({ top: [], markets: [], macro: [], agenda: [] });
	});
});

describe('dailySeries', () => {
	it('quita los huecos y da undefined si no queda nada', () => {
		expect(dailySeries('x', 'X', '$', 'S', [{ date: '2026-10-13', v: null }, { date: '2026-10-14', v: 2 }])?.points).toEqual([{ t: '2026-10-14', v: 2 }]);
		expect(dailySeries('x', 'X', '$', 'S', [])).toBeUndefined();
	});
});
