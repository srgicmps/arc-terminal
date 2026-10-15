// Resúmenes de las bolsas (P4): apertura y cierre de Tokio, Europa y Wall Street, y el de mediodía.
import { describe, expect, it } from 'vitest';
import { emptyLog, eveningRule, madrid, moversLine, sessionRule, zoned, type Inputs, type NotifyLog, type Rule, type RuleContext } from '../alerts/rules.ts';

function run(rule: Rule['run'], d: Inputs, now: number, log: NotifyLog = emptyLog()) {
	const ctx: RuleContext = { now, today: madrid(now).date, log, update: () => {} };
	const alerts = rule(d, ctx);
	return { alerts, ids: alerts.map((a) => a.id) };
}

// Muestras con la forma de jgb.json, vix.json (YieldCurveData), bde.json (SeriesData) y alert-quotes.json.
const curve = (tenor: string, a: number, b: number) => ({
	tenors: [tenor],
	days: [
		{ date: '2026-10-13', values: [a] },
		{ date: '2026-10-14', values: [b] }
	]
});
const bde = {
	series: [
		{ id: 'premium-es-d', label: '', unit: 'pb', geo: 'ES', points: [{ t: '2026-10-13', v: 60 }, { t: '2026-10-14', v: 63 }] },
		{ id: 'bond10-de-d', label: '', unit: '%', geo: 'DE', points: [{ t: '2026-10-14', v: 2.61 }] }
	]
};
const q = (symbol: string, changePct: number) => ({ symbol, price: 100, change: changePct, changePct, prevClose: 100, time: 'x' });
const d: Inputs = {
	jgb: curve('10A', 1.6, 1.62),
	vix: curve('1M', 17.2, 18.4),
	bde,
	alertQuotes: [q('AAPL', 0.4), q('NVDA', 4.1), q('LMT', -3.2), q('BA', 1.5)],
	imp: { current: [{ k: 'a', title: 'Tema A', sources: ['m1', 'm2'], sections: ['geo'], score: 9 }] }
} as Inputs;

describe('resúmenes de las bolsas', () => {
	it('la hora de cada plaza, con su cambio de hora', () => {
		expect(zoned(Date.parse('2026-10-14T00:05:00Z'), 'Asia/Tokyo')).toEqual({ date: '2026-10-14', hm: '09:05' });
		expect(zoned(Date.parse('2026-10-26T13:35:00Z'), 'America/New_York')).toEqual({ date: '2026-10-26', hm: '09:35' });
	});

	it('Tokio abre a las 9:00 de Tokio (las 2:00 de Madrid en octubre), con el bono japonés', () => {
		const { alerts } = run(sessionRule, d, Date.parse('2026-10-14T00:05:00Z'));
		expect(alerts.map((a) => a.id)).toEqual(['tokyo-open:2026-10-14']);
		expect(alerts[0].title).toBe('Tokio abre');
		expect(alerts[0].body).toContain('JGB 10A 1,62 % (+2 pb)');
		expect(alerts[0].body).toContain('1. Tema A (2 medios)');
	});

	it('Wall Street abre a las 9:35 de Nueva York: 15:35 de Madrid y, la semana del desfase, 14:35', () => {
		const normal = run(sessionRule, d, Date.parse('2026-10-14T13:36:00Z'));
		expect(normal.ids).toEqual(['wall-open:2026-10-14']);
		expect(normal.alerts[0].body).toContain('VIX 18,4 (+1,2)');
		expect(normal.alerts[0].body).toContain('NVIDIA +4,1 % · Lockheed Martin −3,2 % · Boeing +1,5 %');
		expect(madrid(Date.parse('2026-10-26T13:36:00Z')).hm).toBe('14:36');
		expect(run(sessionRule, d, Date.parse('2026-10-26T13:36:00Z')).ids).toEqual(['wall-open:2026-10-26']);
		// Antes de la hora, nada.
		expect(run(sessionRule, d, Date.parse('2026-10-14T13:20:00Z')).ids).toEqual([]);
	});

	it('Europa abre con la prima de riesgo diaria y el Bund; el mediodía y el cierre, a su hora', () => {
		// A las 9:10 de Madrid coincide con el cierre de Tokio (16:10 allí); a las 10:35, ya solo Europa.
		expect(run(sessionRule, d, Date.parse('2026-10-14T07:10:00Z')).ids).toEqual(['tokyo-close:2026-10-14', 'europe-open:2026-10-14']);
		const open = run(sessionRule, d, Date.parse('2026-10-14T08:35:00Z'));
		expect(open.ids).toEqual(['europe-open:2026-10-14']);
		expect(open.alerts[0].body).toContain('Prima ES 63 pb (+3) · Bund 10A 2,61 %');
		expect(run(sessionRule, d, Date.parse('2026-10-14T11:31:00Z')).ids).toEqual(['midday:2026-10-14']);
		expect(run(sessionRule, d, Date.parse('2026-10-14T15:41:00Z')).ids).toEqual(['europe-close:2026-10-14']);
	});

	it('ni sábados ni domingos; y sin ningún dato, no se manda', () => {
		expect(run(sessionRule, d, Date.parse('2026-10-17T07:10:00Z')).ids).toEqual([]);
		expect(run(sessionRule, d, Date.parse('2026-10-18T00:05:00Z')).ids).toEqual([]);
		expect(run(sessionRule, {}, Date.parse('2026-10-14T07:10:00Z')).ids).toEqual([]);
	});

	it('valores que más se mueven, en valor absoluto', () => {
		expect(moversLine(d, 2)).toBe('NVIDIA +4,1 % · Lockheed Martin −3,2 %');
		expect(moversLine({})).toBe('');
	});

	it('el «Cierre» de la noche lleva el cierre de Wall Street', () => {
		const { alerts } = run(eveningRule, d, Date.parse('2026-10-14T20:15:00Z'));
		expect(alerts[0].body).toContain('**Cierre de Wall Street**\nVIX 18,4 (+1,2)\nNVIDIA +4,1 %');
	});
});
