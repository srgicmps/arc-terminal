import { describe, expect, it } from 'vitest';
import { countryRisks, riskSignals } from './risk-signals.ts';
import type { GdacsEvent, IodaOutage, OutbreakNews, RadarOutage } from './types.ts';

const NOW = Date.parse('2026-10-14T12:00:00Z');

const quake = (id: string, level: GdacsEvent['level'], score: number, updated = '2026-10-14T08:00:00Z'): GdacsEvent => ({
	id, type: 'EQ', kind: 'Terremoto', level, name: id, country: 'Japan', from: null, to: null, updated,
	severity: '', score, lat: null, lon: null, url: 'https://www.gdacs.org'
});
const outage = (code: string, level: IodaOutage['level'], drop: number | null): IodaOutage => ({
	code, name: code, level, signals: ['bgp'], since: '2026-10-14T06:00:00Z', last: '2026-10-14T10:00:00Z', drop, url: ''
});
const outbreak = (id: string, date: string | null): OutbreakNews => ({ id, title: id, date, summary: '', url: '' });
const cut = (id: string, codes: string[], end: string | null): RadarOutage => ({
	id, codes, cause: 'corte de cable', scope: 'nacional', networks: [], start: '2026-10-13T00:00:00Z', end, url: null
});

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
			outbreaks: [],
			verified: []
		});
	});

	it('Cloudflare Radar: suma a «sin internet» los países con un corte en curso, sin repetir los de IODA', () => {
		const r = riskSignals(
			{
				ioda: [outage('IR', 'critical', 60)],
				radar: [
					cut('curso', ['IR', 'PK'], null),
					cut('ayer', ['CU'], '2026-10-14T02:00:00Z'),
					cut('viejo', ['SY'], '2026-10-10T00:00:00Z'),
					cut('sin país', [], null)
				]
			},
			NOW
		);
		expect(r.counts.outages).toBe(2);
		expect(r.verified.map((o) => o.id)).toEqual(['curso', 'ayer', 'sin país']);
		expect(r.verified[0].country).toBe('Irán, Pakistán');
		expect(r.verified[2].country).toBe('Varios países');
	});

	it('recorta a `limit`', () => {
		const gdacs = Array.from({ length: 8 }, (_, i) => quake(`e${i}`, 'orange', i));
		expect(riskSignals({ gdacs }, NOW, 3).disasters).toHaveLength(3);
	});
});

describe('countryRisks', () => {
	it('reparte por país: GDACS por nombre, IODA por código, OMS por el título (30 días)', () => {
		const r = countryRisks(
			{
				gdacs: [{ ...quake('q', 'red', 2), country: 'Japan' }, { ...quake('x', 'orange', 1), country: 'Atlantis' }],
				ioda: [outage('IR', 'critical', 60), outage('ZZ', 'warning', 10)],
				who: [outbreak('Avian Influenza - Japan', '2026-10-10T00:00:00Z'), outbreak('Cholera - Iran', '2026-07-01T00:00:00Z')]
			},
			NOW
		);
		expect(Object.keys(r).sort()).toEqual(['IR', 'JP']);
		expect(r.JP.disasters.map((d) => d.id)).toEqual(['q']);
		expect(r.JP.outbreaks.map((o) => o.title)).toEqual(['Avian Influenza - Japan']);
		expect(r.IR.outage).toMatchObject({ level: 'critical', drop: 60 });
		expect(r.IR.outbreaks).toEqual([]);
	});
});
