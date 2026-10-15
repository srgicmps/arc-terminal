import { describe, expect, it } from 'vitest';
import { cluster, nearest } from './cluster.ts';
import { allEvents, fromEarnings, fromGdacs, fromImp, fromMeetings, fromQuakes, fromReleases, type TlEvent } from './events.ts';
import { defaultSettings, LANES, moveLane, parseSettings, toggleLane, visibleLanes } from './lanes.ts';
import { DAY, HOUR, MAX_SPAN, MIN_SPAN, pan, rangeDomain, scale, ticks, zoned, zoom } from './scale.ts';
import { change, laneSeries, pointTime, stepPath, valueAt, visible } from './series.ts';
import type { ImpData } from '../../../types.ts';

const T0 = Date.parse('2026-10-15T10:00:00Z');

describe('escala de tiempo', () => {
	it('convierte instantes en píxeles y al revés', () => {
		const sc = scale([0, 1000], [100, 600]);
		expect(sc.x(0)).toBe(100);
		expect(sc.x(500)).toBe(350);
		expect(sc.t(600)).toBe(1000);
	});

	it('los rangos dejan una parte para el futuro', () => {
		const [a, b] = rangeDomain('7d', T0);
		expect(b - a).toBe(7 * DAY);
		expect(a < T0 && b > T0).toBe(true);
	});

	it('el zoom deja quieto el instante del puntero y respeta los límites', () => {
		const d = [0, 10 * DAY] as const;
		const z = zoom(d, 2 * DAY, 0.5);
		expect(z[1] - z[0]).toBe(5 * DAY);
		// El instante sigue en la misma fracción (20 %) del dominio.
		expect((2 * DAY - z[0]) / (z[1] - z[0])).toBeCloseTo(0.2);
		expect(zoom(d, 0, 1e-9)[1] - zoom(d, 0, 1e-9)[0]).toBe(MIN_SPAN);
		expect(zoom(d, 0, 1e9)[1] - zoom(d, 0, 1e9)[0]).toBe(MAX_SPAN);
		expect(pan(d, DAY)).toEqual([DAY, 11 * DAY]);
	});

	it('las marcas caen dentro, ordenadas y sin pasar del tope', () => {
		for (const span of [6 * HOUR, DAY, 7 * DAY, 30 * DAY, 365 * DAY, 700 * DAY]) {
			const d = [T0 - span, T0] as const;
			const m = ticks(d, 10, 'UTC');
			expect(m.length).toBeGreaterThan(0);
			expect(m.length).toBeLessThanOrEqual(10);
			for (let i = 0; i < m.length; i++) {
				expect(m[i].t >= d[0] && m[i].t <= d[1]).toBe(true);
				if (i) expect(m[i].t).toBeGreaterThan(m[i - 1].t);
			}
		}
	});

	it('en un día marca horas en punto, y la medianoche como mayor', () => {
		const m = ticks([Date.parse('2026-10-14T20:00:00Z'), Date.parse('2026-10-15T20:00:00Z')], 10, 'UTC');
		expect(m.every((x) => x.t % (3 * HOUR) === 0)).toBe(true);
		const mid = m.find((x) => x.t === Date.parse('2026-10-15T00:00:00Z'));
		expect(mid?.major).toBe(true);
		expect(mid?.label).toMatch(/15/);
	});

	it('en un año marca el día 1 de los meses', () => {
		const m = ticks([Date.parse('2026-01-10T00:00:00Z'), Date.parse('2026-12-20T00:00:00Z')], 6, 'UTC');
		for (const x of m) expect(new Date(x.t).getUTCDate()).toBe(1);
	});

	it('pasa una hora de reloj de una zona a UTC, con horario de verano', () => {
		expect(new Date(zoned('2026-10-29', '14:15', 'Europe/Berlin')).toISOString()).toBe('2026-10-29T13:15:00.000Z');
		expect(new Date(zoned('2026-07-23', '14:15', 'Europe/Berlin')).toISOString()).toBe('2026-07-23T12:15:00.000Z');
		expect(new Date(zoned('2026-10-28', '14:00', 'America/New_York')).toISOString()).toBe('2026-10-28T18:00:00.000Z');
	});
});

describe('sucesos', () => {
	const imp: ImpData = {
		date: '2026-10-15',
		current: [
			{ k: 'a', title: 'Tema A', url: 'https://a', sources: ['x', 'y'], score: 40, sections: ['eco'], first: '2026-10-15T07:30:00Z', time: null }
		],
		days: [
			{ date: '2026-10-14', items: [{ k: 'b', title: 'Tema B', url: 'https://b', sources: ['x'], score: 10 }] },
			{ date: '2026-10-15', items: [{ k: 'a', title: 'Tema A', url: 'https://a', sources: ['x'], score: 30 }, { k: 'b', title: 'Tema B', titleEs: 'Tema B (es)', url: 'https://b2', sources: ['x'], score: 20 }] }
		],
		seen: []
	};

	it('IMP: un suceso por tema, en su primera aparición y con peso por puntuación', () => {
		const ev = fromImp(imp);
		expect(ev).toHaveLength(2);
		const a = ev.find((e) => e.id === 'imp:a')!;
		const b = ev.find((e) => e.id === 'imp:b')!;
		expect(a.t).toBe(Date.parse('2026-10-15T07:30:00Z'));
		expect(a.weight).toBe(1);
		expect(b.t).toBe(Date.parse('2026-10-14T12:00:00Z'));
		expect(b.title).toBe('Tema B (es)');
		expect(b.weight).toBeCloseTo(Math.sqrt(20 / 40));
		expect(fromImp(null)).toEqual([]);
	});

	it('terremotos y GDACS van al carril de la tierra; el peso sale de la magnitud y del nivel', () => {
		const q = fromQuakes([{ id: 'u1', mag: 8, place: 'Chile', time: '2026-10-14T03:00:00Z', url: 'u', tsunami: true, alert: 'red', lat: 0, lon: 0, depth: 10 }]);
		expect(q[0]).toMatchObject({ lane: 'tierra', weight: 1, href: '/geo' });
		const g = fromGdacs([
			{ id: 'TC1', type: 'TC', kind: 'Ciclón tropical', level: 'orange', name: 'Milton', country: '', from: '2026-10-10T00:00:00Z', to: null, updated: null, severity: '', score: null, lat: null, lon: null, url: 'g' },
			{ id: 'X', type: 'FL', kind: 'Inundación', level: 'red', name: '', country: 'India', from: null, to: null, updated: null, severity: '', score: null, lat: null, lon: null, url: 'g' }
		]);
		// Sin fecha, fuera.
		expect(g).toHaveLength(1);
		expect(g[0].title).toBe('Ciclón tropical · Milton');
		expect(g[0].weight).toBe(0.6);
	});

	it('publicaciones: sin repetir las que están en pasadas y próximas', () => {
		const r = { date: '2026-10-15T12:30:00Z', allDay: false, title: 'IPC', source: 'BLS' as const, topic: 'cpi-us' };
		const ev = fromReleases({ events: [r], past: [r] });
		expect(ev).toHaveLength(1);
		expect(ev[0].weight).toBe(0.7);
	});

	it('resultados: hora de Nueva York y ficha del valor', () => {
		const [e] = fromEarnings([{ date: '2026-10-20', symbol: 'NVDA', hour: 'amc', quarter: 3, year: 2026, epsEstimate: null, epsActual: null, revenueEstimate: 5e10, revenueActual: null }]);
		expect(new Date(e.t).toISOString()).toBe('2026-10-20T20:30:00.000Z');
		expect(e.href).toBe('/s?sym=NVDA');
		expect(e.title).toBe('Resultados de NVDA (T3 2026)');
		expect(e.weight).toBeGreaterThan(0.8);
	});

	it('reuniones de bancos centrales, a la hora de la decisión', () => {
		const ev = fromMeetings([{ bank: 'fed', date: '2026-12-09', sep: true }]);
		expect(new Date(ev[0].t).toISOString()).toBe('2026-12-09T19:00:00.000Z');
		expect(ev[0]).toMatchObject({ lane: 'bancos', weight: 1, href: '/btmm' });
	});

	it('allEvents ordena por instante y aguanta fuentes rotas', () => {
		const ev = allEvents({ imp, quakes: [{ broken: true }] as never }, []);
		expect(ev.map((e) => e.id)).toEqual(['imp:b', 'imp:a']);
	});
});

describe('agrupar', () => {
	const ev = (id: string, t: number, weight = 0.5): TlEvent => ({ id, t, weight, lane: 'imp', title: id, href: '/imp' });

	it('junta los que se solapan y deja el de más peso delante', () => {
		const sc = scale([0, 1000], [0, 1000]);
		const c = cluster([ev('a', 100, 0.2), ev('b', 105, 0.9), ev('c', 500), ev('d', 5000)], sc, 12);
		expect(c).toHaveLength(2);
		expect(c[0].events.map((e) => e.id)).toEqual(['b', 'a']);
		expect(c[0].x).toBe(105);
		expect(nearest(c, 480, 30)?.id).toBe('c');
		expect(nearest(c, 300, 30)).toBeNull();
	});

	it('con más zoom se separan', () => {
		const events = [ev('a', 100), ev('b', 105)];
		expect(cluster(events, scale([0, 1000], [0, 1000]))).toHaveLength(1);
		expect(cluster(events, scale([90, 115], [0, 1000]))).toHaveLength(2);
	});
});

describe('series de mercados', () => {
	const pts = [
		{ t: 100, v: 1 },
		{ t: 200, v: 2 },
		{ t: 300, v: 4 }
	];

	it('el valor en un instante es el último cierre conocido', () => {
		expect(valueAt(pts, 50)).toBeNull();
		expect(valueAt(pts, 250)?.v).toBe(2);
		expect(valueAt(pts, 900)?.v).toBe(4);
	});

	it('los visibles llevan uno más a cada lado, y la variación va del primero al último', () => {
		expect(visible(pts, [150, 250]).map((p) => p.v)).toEqual([1, 2, 4]);
		expect(change(pts, [150, 350])).toBe(100);
		expect(change(pts, [150, 250])).toBeNull();
	});

	it('el trazo es en escalones y no pasa de «ahora»', () => {
		const d = stepPath(pts, scale([0, 400], [0, 400]), 0, 10, 350);
		expect(d.startsWith('M100,10')).toBe(true);
		expect(d.endsWith('H350')).toBe(true);
		expect(stepPath([], scale([0, 1], [0, 1]), 0, 1)).toBe('');
	});

	it('saca la serie del archivo: curvas por plazo, series por id y el historial de bitcoin', () => {
		const us10 = LANES.find((l) => l.id === 'us10')!;
		const btc = LANES.find((l) => l.id === 'btc')!;
		const eur = LANES.find((l) => l.id === 'eurusd')!;
		if (us10.kind !== 'market' || btc.kind !== 'market' || eur.kind !== 'market') throw new Error('carril');
		const curve = { tenors: ['2A', '10A'], days: [{ date: '2026-10-14', values: [3.5, 4.1] }, { date: '2026-10-15', values: [3.4, null] }] };
		expect(laneSeries(us10, curve)).toEqual([{ t: pointTime('2026-10-14'), v: 4.1 }]);
		expect(laneSeries(btc, { coins: [], btcHistory: [{ date: '2026-10-15', usd: 1 }, { date: '2026-10-14', usd: 2 }] }).map((p) => p.v)).toEqual([2, 1]);
		expect(laneSeries(eur, { series: [{ id: 'eurusd', points: [{ t: '2026-10-15', v: 1.1 }] }] })).toHaveLength(1);
		expect(laneSeries(eur, null)).toEqual([]);
	});
});

describe('carriles', () => {
	it('por defecto, todos en orden y algunos de mercados ocultos', () => {
		const s = defaultSettings();
		expect(s.order).toHaveLength(LANES.length);
		expect(visibleLanes(s).length).toBe(LANES.length - s.hidden.length);
	});

	it('lo guardado se arregla: fuera ids viejos, dentro los carriles nuevos', () => {
		const s = parseSettings(JSON.stringify({ order: ['vix', 'nope', 'imp', 'imp'], hidden: ['imp', 'zzz'] }));
		expect(s.order.slice(0, 2)).toEqual(['vix', 'imp']);
		expect(s.order).toHaveLength(LANES.length);
		expect(s.hidden).toEqual(['imp']);
		expect(parseSettings('{roto')).toEqual(defaultSettings());
	});

	it('subir, bajar, ocultar y enseñar', () => {
		let s = defaultSettings();
		s = moveLane(s, 'tierra', -1);
		expect(s.order.slice(0, 2)).toEqual(['tierra', 'imp']);
		expect(moveLane(s, 'tierra', -1)).toBe(s);
		s = toggleLane(s, 'imp');
		expect(visibleLanes(s).some((l) => l.id === 'imp')).toBe(false);
		s = toggleLane(s, 'imp');
		expect(visibleLanes(s)[1].id).toBe('imp');
	});
});
