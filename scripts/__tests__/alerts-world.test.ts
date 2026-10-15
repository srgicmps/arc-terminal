import { describe, expect, it } from 'vitest';
import { emptyLog, madrid, type NotifyLog, type Rule, type RuleContext } from '../alerts/rules.ts';
import { blackoutRule, gdacsRule, iodaRule, statusRule, steepestDrop, whoRule, type WorldInputs } from '../alerts/world.ts';
import type { GdacsEvent } from '../sources/gdacs.ts';
import type { IodaOutage } from '../sources/ioda.ts';
import type { DemandData } from '../sources/ree-demand.ts';
import type { ServiceStatus } from '../sources/statuspage.ts';
import type { OutbreakNews } from '../sources/who.ts';

// 14 oct 2026, 12:00 en Madrid (CEST).
const NOW = Date.parse('2026-10-14T10:00:00Z');
const MIN = 60_000;
const HOUR = 60 * MIN;

/** Ejecuta una regla y devuelve sus avisos y el historial con los cambios «siempre» y los commits aplicados. */
function run(rule: Rule['run'], d: WorldInputs, log: NotifyLog = emptyLog(), now = NOW) {
	const updates: ((l: NotifyLog) => void)[] = [];
	const ctx: RuleContext = { now, today: madrid(now).date, log, update: (fn) => void updates.push(fn) };
	const alerts = rule(d, ctx);
	const after = structuredClone(log);
	for (const fn of updates) fn(after);
	for (const a of alerts) a.commit?.(after);
	return { alerts, ids: alerts.map((a) => a.id), after };
}

const gdacs = (id: string, level: 'red' | 'orange'): GdacsEvent => ({
	id,
	type: 'EQ',
	kind: 'Terremoto',
	level,
	name: 'Earthquake in Japan',
	country: 'Japan',
	from: '2026-10-14T08:00:00.000Z',
	to: '2026-10-14T08:00:00.000Z',
	updated: '2026-10-14T09:00:00.000Z',
	severity: 'Magnitude 7.4M',
	score: 3,
	lat: 38,
	lon: 142,
	url: 'https://www.gdacs.org/report.aspx?eventtype=EQ&eventid=1'
});

describe('GDACS', () => {
	it('avisa de las rojas, una vez por evento, y olvida las que desaparecen', () => {
		const first = run(gdacsRule, { gdacs: [gdacs('EQ1', 'red'), gdacs('TC2', 'orange')] });
		expect(first.ids).toEqual(['gdacs:EQ1']);
		expect(first.alerts[0].title).toBe('🔴 Terremoto · Japan');
		// Otra pasada (otro episodio): no repite, aunque el historial de entradas ya no lo tenga.
		expect(run(gdacsRule, { gdacs: [gdacs('EQ1', 'red')] }, first.after).ids).toEqual([]);
		// Una pasada vacía por error: la marca se queda y, si el evento vuelve, no se repite.
		const empty = run(gdacsRule, { gdacs: [] }, first.after, NOW + HOUR).after;
		expect(empty.last['gdacs:EQ1']).toBeDefined();
		expect(run(gdacsRule, { gdacs: [gdacs('EQ1', 'red')] }, empty, NOW + 2 * HOUR).ids).toEqual([]);
		// Tras 48 h sin verlo, se olvida.
		expect(run(gdacsRule, { gdacs: [] }, first.after, NOW + 49 * HOUR).after.last).toEqual({});
		// Sin gdacs.json no se toca nada.
		expect(run(gdacsRule, {}, first.after).after.last).toEqual(first.after.last);
	});
});

/** Demanda cada 5 min desde las 11:30 de Madrid; `values` son MW reales. */
const demand = (values: number[], forecast = 30000, endAt = NOW): DemandData => {
	const recent = values.map((real, i) => ({
		time: new Date(endAt - (values.length - 1 - i) * 5 * MIN).toISOString(),
		real,
		forecast
	}));
	const last = recent.at(-1)!;
	return {
		time: last.time,
		real: last.real,
		forecast,
		scheduled: forecast,
		gap: Math.round((1 - last.real / forecast) * 1000) / 10,
		recent
	};
};

describe('apagón', () => {
	it('mide la mayor caída en 30 minutos', () => {
		expect(steepestDrop(demand([30000, 29000, 15000]).recent, 30)).toBeCloseTo(0.5, 2);
		// La caída lenta (2 h) no cuenta en una ventana de 30 min.
		const slow = Array.from({ length: 25 }, (_, i) => 30000 - i * 400);
		expect(steepestDrop(demand(slow).recent, 30)).toBeLessThan(0.15);
	});

	it('avisa con la demanda muy por debajo de la prevista tras una caída brusca (28 de abril de 2025)', () => {
		const r = run(blackoutRule, { reeDemand: demand([27000, 26900, 26800, 12000, 11000]) });
		expect(r.ids).toEqual(['blackout:2026-10-14:12']);
		expect(r.alerts[0].body).toContain('63 % por debajo de la prevista');
		expect(r.alerts[0].body).toContain('ha caído un 59 %');
		// Espera de 6 h: una hora después, nada.
		const later = demand([11000, 11500, 10000, 8000], 30000, NOW + 60 * MIN);
		expect(run(blackoutRule, { reeDemand: later }, r.after, NOW + 60 * MIN).ids).toEqual([]);
	});

	it('con una caída enorme avisa aunque la prevista se haya rehecho (como hizo REE el 28/04/2025)', () => {
		const redone = { ...demand([27075, 26968, 1785, 1778]), forecast: 1745, gap: -1.9 };
		expect(run(blackoutRule, { reeDemand: redone }).ids).toEqual(['blackout:2026-10-14:12']);
		// Una caída del 20 % sin diferencia con la prevista no basta.
		const mid = { ...demand([30000, 30000, 24000]), forecast: 24000, gap: 0 };
		expect(run(blackoutRule, { reeDemand: mid }).ids).toEqual([]);
	});

	it('no avisa por una bajada lenta, por poca diferencia ni con datos viejos', () => {
		const slow = Array.from({ length: 25 }, (_, i) => 30000 - i * 400);
		expect(run(blackoutRule, { reeDemand: demand(slow) }).ids).toEqual([]);
		expect(run(blackoutRule, { reeDemand: demand([30000, 25000], 30000) }).ids).toEqual([]);
		const old = demand([27000, 12000], 30000, NOW - 2 * 60 * MIN);
		expect(run(blackoutRule, { reeDemand: old }).ids).toEqual([]);
	});
});

const outage = (code: string, level: 'critical' | 'warning', since = '2026-10-14T08:00:00.000Z'): IodaOutage => ({
	code,
	name: code,
	level,
	signals: ['bgp', 'ping-slash24'],
	since,
	last: since,
	drop: 60,
	url: `https://ioda.inetintel.cc.gatech.edu/country/${code}`
});

describe('IODA', () => {
	it('países grandes en crítico y España también en aviso; los pequeños no', () => {
		const r = run(iodaRule, { ioda: [outage('FR', 'critical'), outage('FR', 'warning'), outage('ES', 'warning'), outage('SY', 'critical'), outage('DE', 'warning')] });
		expect(r.ids).toEqual(['ioda:FR:2026-10-14T08:00:00.000Z', 'ioda:ES:2026-10-14T08:00:00.000Z']);
		expect(r.alerts[0].body).toContain('hasta un 60 % por debajo de lo normal');
	});

	it('un aviso por país mientras siga caído, aunque se mueva el inicio', () => {
		const first = run(iodaRule, { ioda: [outage('FR', 'critical')] });
		const moved = outage('FR', 'critical', '2026-10-14T09:00:00.000Z');
		expect(run(iodaRule, { ioda: [moved] }, first.after).ids).toEqual([]);
		// Se recupera y vuelve a caer al cabo de un rato: dentro de las 48 h, no se repite.
		const back = run(iodaRule, { ioda: [] }, first.after, NOW + HOUR).after;
		expect(run(iodaRule, { ioda: [moved] }, back, NOW + 2 * HOUR).ids).toEqual([]);
		// Pasadas las 48 h sin verlo, otra caída sí avisa.
		const later = run(iodaRule, { ioda: [] }, first.after, NOW + 49 * HOUR).after;
		expect(run(iodaRule, { ioda: [moved] }, later, NOW + 50 * HOUR).ids).toEqual(['ioda:FR:2026-10-14T09:00:00.000Z']);
	});
});

const service = (id: string, indicator: ServiceStatus['indicator'], incidents: [string, ServiceStatus['indicator']][], stale = false): ServiceStatus => ({
	id,
	name: id,
	indicator,
	description: 'Partial System Outage',
	incidents: incidents.map(([iid, impact], n) => ({
		id: iid,
		name: `Incidencia ${iid}`,
		impact,
		status: 'investigating',
		started: '2026-10-14T08:00:00.000Z',
		updated: `2026-10-14T09:0${n}:00.000Z`,
		url: `https://status/${iid}`
	})),
	page: 'https://status',
	...(stale ? { stale: true as const } : {})
});

describe('páginas de estado', () => {
	it('major o critical: las incidencias graves o, si no hay, la más reciente', () => {
		const r = run(statusRule, {
			statuspage: [
				service('github', 'major', [['a', 'major'], ['b', 'minor']]),
				service('cloudflare', 'major', [['c', 'minor'], ['d', 'minor']]),
				service('npm', 'minor', [['e', 'minor']]),
				service('aws', 'critical', [['f', 'critical']], true)
			]
		});
		expect(r.ids).toEqual(['status:github:a', 'status:cloudflare:d']);
		expect(r.alerts[0].title).toBe('🛠 github: caída parcial');
	});

	it('no repite y conserva la marca de un servicio que esta vez no se ha podido leer', () => {
		const first = run(statusRule, { statuspage: [service('aws', 'critical', [['f', 'critical']])] });
		expect(first.ids).toEqual(['status:aws:f']);
		const stale = run(statusRule, { statuspage: [service('aws', 'critical', [['f', 'critical']], true)] }, first.after);
		expect(stale.ids).toEqual([]);
		expect(stale.after.last['status:aws:f']).toBeDefined();
		expect(run(statusRule, { statuspage: [service('aws', 'critical', [['f', 'critical']])] }, stale.after).ids).toEqual([]);
		expect(run(statusRule, { statuspage: [service('aws', 'none', [])] }, stale.after, NOW + 49 * HOUR).after.last).toEqual({});
	});
});

const don = (id: string): OutbreakNews => ({
	id,
	title: `Brote ${id}`,
	date: '2026-10-10T15:00:00.000Z',
	summary: 'Resumen.',
	url: `https://www.who.int/emergencies/disease-outbreak-news/item/${id}`
});

describe('OMS', () => {
	it('la primera vez solo apunta; luego avisa de los partes nuevos, una vez', () => {
		const base = run(whoRule, { who: [don('2026-DON619'), don('2026-DON620')] });
		expect(base.ids).toEqual([]);
		const next = run(whoRule, { who: [don('2026-DON621'), don('2026-DON620')] }, base.after);
		expect(next.ids).toEqual(['who:2026-DON621']);
		expect(next.alerts[0].title).toBe('🦠 OMS: Brote 2026-DON621');
		expect(run(whoRule, { who: [don('2026-DON621'), don('2026-DON620')] }, next.after).ids).toEqual([]);
		// La marca de inicio no se borra aunque cambie la lista.
		expect(next.after.last['who:init']).toBeDefined();
	});
});
