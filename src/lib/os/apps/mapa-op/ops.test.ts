import { describe, expect, it } from 'vitest';
import {
	ago,
	buildPoints,
	clampCursor,
	countByLayer,
	DAY,
	fitView,
	histogram,
	HOUR,
	inTime,
	MAX_SPAN,
	MIN_W,
	newestFirst,
	panBy,
	parseParams,
	parseT,
	playStep,
	timeRange,
	visible,
	WORLD,
	zoomAt,
	type OpLayer,
	type OpPoint
} from './ops.ts';
import type { GlobePoint } from '../../../geo/globe.ts';
import type { Quake } from '../../../types.ts';

const NOW = Date.parse('2026-10-15T12:00:00Z');
const pt = (layer: OpLayer, at: number | null, id = `${layer}-${at}`) => ({ id, layer, at });

const quake = (id: string, time: string, mag = 5.2): Quake => ({
	id,
	mag,
	place: 'Cerca de la costa',
	time,
	url: `https://usgs.example/${id}`,
	tsunami: false,
	alert: null,
	lat: 10,
	lon: 20,
	depth: 12
});

describe('buildPoints', () => {
	const points = buildPoints({
		quakes: [quake('a', '2026-10-15T10:00:00Z', 6.4), quake('b', '2026-10-14T08:00:00Z')],
		hazards: {
			storms: [
				{
					id: 'al01',
					name: 'Kirk',
					classification: 'HU',
					knots: 90,
					pressure: 960,
					lat: 20,
					lon: -50,
					updated: '2026-10-15T09:00:00Z',
					url: 'https://nhc.example'
				}
			],
			events: []
		},
		czib: {
			items: [
				{
					id: 'CZIB-1',
					area: 'Ucrania',
					areaEn: 'Ukraine',
					issued: '2022-02-24',
					revised: '2026-09-01',
					validUntil: null,
					url: 'https://easa.example'
				}
			]
		},
		navwarn: {
			items: [
				{
					id: 'HYDROPAC 1/26',
					region: 'Mar Rojo',
					place: '',
					kind: 'Misiles',
					text: '',
					issued: '2026-10-13T00:00:00Z',
					at: [15, 41]
				}
			]
		},
		news: null
	});

	it('pone la capa delante del id, la hora en ms y la fuente', () => {
		const q = points.find((p) => p.id === 'quakes:q-a')!;
		expect(q).toMatchObject({ layer: 'quakes', at: Date.parse('2026-10-15T10:00:00Z'), source: 'USGS', strong: true });
		expect(q.detail.find(([k]) => k === 'Magnitud')?.[1]).toBe('6,4');
		expect(new Set(points.map((p) => p.id)).size).toBe(points.length);
	});

	it('da hora a ciclones, avisos a barcos y espacio aéreo', () => {
		expect(points.find((p) => p.layer === 'storms')?.t).toBe('2026-10-15T09:00:00Z');
		expect(points.find((p) => p.layer === 'maritime')?.at).toBe(Date.parse('2026-10-13T00:00:00Z'));
		expect(points.find((p) => p.layer === 'airspace')?.t).toBe('2026-09-01');
	});

	it('sin datos, ninguna capa rompe', () => {
		expect(buildPoints({})).toEqual([]);
	});
});

describe('filtro por capa y por tiempo', () => {
	const points = [
		pt('quakes', NOW - 2 * HOUR),
		pt('quakes', NOW - 30 * HOUR),
		pt('storms', NOW - 5 * DAY),
		pt('airspace', NOW - 400 * DAY),
		pt('straits', null),
		pt('maritime', NOW + HOUR)
	];

	it('el cursor esconde lo posterior; el periodo, lo anterior (salvo los estados)', () => {
		const f = {
			layers: new Set<OpLayer>(['quakes', 'storms', 'airspace', 'straits', 'maritime']),
			cursor: NOW,
			period: '24h' as const
		};
		expect(visible(points, f).map((p) => p.id)).toEqual([
			`quakes-${NOW - 2 * HOUR}`,
			`airspace-${NOW - 400 * DAY}`,
			'straits-null'
		]);
	});

	it('rebobinar a hace un día enseña el terremoto de entonces y no el de ahora', () => {
		const f = { layers: new Set<OpLayer>(['quakes']), cursor: NOW - 24 * HOUR, period: '24h' as const };
		expect(visible(points, f).map((p) => p.at)).toEqual([NOW - 30 * HOUR]);
	});

	it('con «Todo» no hay límite por detrás; las capas apagadas no salen', () => {
		const f = { layers: new Set<OpLayer>(['storms']), cursor: NOW, period: 'all' as const };
		expect(visible(points, f)).toHaveLength(1);
	});

	it('los puntos sin hora se pueden esconder', () => {
		expect(inTime(pt('straits', null), { cursor: NOW, period: 'all', untimed: false })).toBe(false);
	});

	it('cuenta por capa con el filtro de tiempo, aunque la capa esté apagada', () => {
		const c = countByLayer(points, { cursor: NOW, period: '72h' });
		expect(c.quakes).toBe(2);
		expect(c.storms).toBe(0);
		expect(c.airspace).toBe(1);
		expect(c.maritime).toBe(0);
		expect(c.sanctions).toBe(0);
	});
});

describe('línea de tiempo', () => {
	it('con un periodo, el rango acaba ahora y dura el periodo', () => {
		expect(timeRange([pt('quakes', NOW - DAY)], NOW, '24h')).toEqual({ start: NOW - DAY, end: NOW });
	});

	it('con «Todo», empieza en el suceso más antiguo, sin pasar de 30 días ni contar los estados', () => {
		expect(timeRange([pt('quakes', NOW - 3 * DAY), pt('airspace', NOW - 900 * DAY)], NOW, 'all')).toEqual({
			start: NOW - 3 * DAY,
			end: NOW
		});
		expect(timeRange([pt('quakes', NOW - 90 * DAY)], NOW, 'all').start).toBe(NOW - MAX_SPAN);
		expect(timeRange([], NOW, 'all')).toEqual({ start: NOW - DAY, end: NOW });
	});

	it('si un suceso es del futuro, el rango llega hasta él', () => {
		expect(timeRange([pt('quakes', NOW + HOUR)], NOW, '6h').end).toBe(NOW + HOUR);
	});

	it('el histograma reparte los sucesos por tramos y deja fuera estados y los de fuera del rango', () => {
		const r = { start: NOW - 4 * HOUR, end: NOW };
		const h = histogram(
			[
				pt('quakes', NOW - 4 * HOUR),
				pt('quakes', NOW - 30 * 60_000),
				pt('quakes', NOW),
				pt('straits', NOW - HOUR),
				pt('quakes', NOW - DAY)
			],
			r,
			4
		);
		expect(h).toEqual([1, 0, 0, 2]);
	});

	it('reproducir avanza, se para al final y vuelve a empezar', () => {
		const r = { start: 0, end: 100 };
		expect(playStep(0, r, 10)).toEqual({ cursor: 10, done: false });
		expect(playStep(95, r, 10)).toEqual({ cursor: 100, done: true });
		expect(playStep(100, r, 10)).toEqual({ cursor: 0, done: false });
		expect(clampCursor(150, r)).toBe(100);
		expect(clampCursor(-5, r)).toBe(0);
	});

	it('dice cuánto hace y ordena lo más nuevo primero', () => {
		expect(ago(NOW - 200 * 60_000, NOW)).toBe('hace 3 h 20 min');
		expect(ago(NOW - 50 * HOUR, NOW)).toBe('hace 2 d 2 h');
		expect(ago(NOW, NOW)).toBe('ahora');
		expect(newestFirst([pt('quakes', null, 'x'), pt('quakes', 1, 'a'), pt('quakes', 5, 'b')]).map((p) => p.id)).toEqual(
			['b', 'a', 'x']
		);
		expect(parseT('2026-10-15')).toBe(Date.parse('2026-10-15T00:00:00Z'));
		expect(parseT('no')).toBeNull();
	});
});

describe('mapa plano', () => {
	it('encaja el mundo en la proporción de la ventana', () => {
		const v = fitView(4);
		expect(v.h).toBe(WORLD.h);
		expect(v.w).toBe(WORLD.h * 4);
		expect(fitView(1).w).toBe(WORLD.w);
	});

	it('acercar deja quieto el punto bajo el ratón y tiene tope', () => {
		const max = fitView(WORLD.w / WORLD.h);
		const z = zoomAt(max, 0.5, 0.5, 0.5, max);
		expect(z.w).toBe(max.w / 2);
		expect(z.x + z.w / 2).toBeCloseTo(max.x + max.w / 2);
		let v = max;
		for (let i = 0; i < 40; i++) v = zoomAt(v, 0.5, 0, 0, max);
		expect(v.w).toBe(MIN_W);
		expect(zoomAt(z, 4, 0.5, 0.5, max)).toEqual(max);
	});

	it('mover el mapa no lo saca del mundo', () => {
		const v = { x: 100, y: 50, w: 90, h: 45 };
		expect(panBy(v, 100, 0, 900, 450).x).toBeCloseTo(90);
		expect(panBy(v, -100000, 0, 900, 450).x + v.w / 2).toBe(360);
	});
});

describe('parámetros de la ventana', () => {
	it('lee capas y periodo, e ignora lo que no conoce', () => {
		expect(parseParams('?capas=quakes,nada,storms&periodo=24h')).toEqual({
			layers: ['quakes', 'storms'],
			period: '24h'
		});
		expect(parseParams('/mapa?periodo=siempre')).toEqual({});
		expect(parseParams(undefined)).toEqual({});
	});
});

// OpPoint encaja con lo que pide el globo (GlobePoint) sin conversión: si no, falla pnpm check.
const _globe: GlobePoint = {} as OpPoint;
void _globe;
