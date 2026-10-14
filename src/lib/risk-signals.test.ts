import { describe, expect, it } from 'vitest';
import { riskSignals } from './risk-signals.ts';
import type { GdacsEvent, IodaOutage, OutbreakNews } from './types.ts';

const NOW = Date.parse('2026-10-14T12:00:00Z');

const quake = (id: string, level: GdacsEvent['level'], score: number, updated = '2026-10-14T08:00:00Z'): GdacsEvent => ({
	id, type: 'EQ', kind: 'Terremoto', level, name: id, country: 'Japan', from: null, to: null, updated,
	severity: '', score, lat: null, lon: null, url: 'https://www.gdacs.org'
});
const outage = (code: string, level: IodaOutage['level'], drop: number | null): IodaOutage => ({
	code, name: code, level, signals: ['bgp'], since: '2026-10-14T06:00:00Z', last: '2026-10-14T10:00:00Z', drop, url: ''
});
const outbreak = (id: string, date: string | null): OutbreakNews => ({ id, title: id, date, summary: '', url: '' });

describe('riskSignals', () => {
	it('cuenta y ordena: rojas antes, críticas antes, brotes de los últimos 30 días', () => {
		const r = riskSignals(
			{
				gdacs: [quake('a', 'orange', 3), quake('b', 'red', 1), quake('c', 'orange', 3, '2026-10-14T10:00:00Z')],
				ioda: [outage('ES', 'warning', 90), outage('IR', 'critical', 40), outage('CU', 'critical', 80)],
				who: [outbreak('nuevo', '2026-10-10T00:00:00Z'), outbreak('viejo', '2026-08-01T00:00:00Z'), outbreak('sin fecha', null)],
				advisories: { items: [{ level: 4 }, { level: 4 }, { level: 2 }] as never }
			},
			NOW
		);
		expect(r.counts).toEqual({ red: 1, orange: 2, outages: 3, outbreaks: 1, level4: 2 });
		expect(r.disasters.map((e) => e.id)).toEqual(['b', 'c', 'a']);
		expect(r.outages.map((o) => o.code)).toEqual(['CU', 'IR', 'ES']);
		expect(r.outages[0].country).toBe('Cuba');
		expect(r.outbreaks.map((o) => o.id)).toEqual(['nuevo']);
	});

	it('sin datos, todo vacío y sin avisos de viaje', () => {
		expect(riskSignals({}, NOW)).toEqual({
			counts: { red: 0, orange: 0, outages: 0, outbreaks: 0, level4: null },
			disasters: [],
			outages: [],
			outbreaks: []
		});
	});

	it('recorta a `limit`', () => {
		const gdacs = Array.from({ length: 8 }, (_, i) => quake(`e${i}`, 'orange', i));
		expect(riskSignals({ gdacs }, NOW, 3).disasters).toHaveLength(3);
	});
});
