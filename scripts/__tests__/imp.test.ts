import { afterEach, describe, expect, it, vi } from 'vitest';
import { level, makeContext, phases, waves } from '../lib.ts';
import { confirms, imp, keywords, mergeDay, mergeSections, normUrl, scoreGroups, track, type Tracked } from '../sources/imp.ts';
import type { ImpData, ImpSeen, NewsItem } from '../../src/lib/types.ts';
import { mockFetch } from './mock.ts';

const NOW = Date.parse('2026-10-14T12:00:00Z');
const HOUR = 3_600_000;
const iso = (hoursAgo: number) => new Date(NOW - hoursAgo * HOUR).toISOString();

const news = (title: string, source: string, url: string, hoursAgo = 1, also?: NewsItem['also']): NewsItem => ({
	title,
	url,
	source,
	time: iso(hoursAgo),
	summary: '',
	also
});

const tracked = (over: Partial<Tracked> = {}): Tracked => ({
	k: 'k1',
	first: iso(0),
	title: 'Tema de prueba',
	url: 'https://a.example/1',
	time: iso(1),
	words: new Set(),
	sources: ['El País'],
	sections: ['es'],
	urls: ['a.example/1'],
	links: [{ source: 'El País', url: 'https://a.example/1' }],
	...over
});

describe('fases de update.ts', () => {
	it('las fuentes `after` van a la segunda fase', () => {
		const [first, second] = phases([{ name: 'a' }, { name: 'b', after: true as const }, { name: 'c' }]);
		expect(first.map((s) => s.name)).toEqual(['a', 'c']);
		expect(second.map((s) => s.name)).toEqual(['b']);
	});

	it('las derivadas van por niveles: after: 2 detrás de after: true', () => {
		const list = [{ name: 'trad', after: 2 }, { name: 'a' }, { name: 'imp', after: true as const }, { name: 'b' }, { name: 'x', after: 1 }];
		expect(waves(list).map((w) => w.map((s) => s.name))).toEqual([['a', 'b'], ['imp', 'x'], ['trad']]);
		expect([level({}), level({ after: true }), level({ after: 3 })]).toEqual([0, 1, 3]);
		const plain: { name: string; after?: number }[] = [{ name: 'a' }, { name: 'b' }];
		expect(waves(plain).length).toBe(1);
	});

	it('el contexto da lo guardado en esta pasada y, si no, lo del disco', () => {
		const ctx = makeContext(new Map([['news-es', { items: [1] }]]), (name) => (name === 'boe' ? { disk: true } : undefined));
		expect(ctx.get('news-es')).toEqual({ items: [1] });
		expect(ctx.get('boe')).toEqual({ disk: true });
		expect(ctx.get('nada')).toBeUndefined();
	});
});

describe('normUrl', () => {
	it('quita protocolo, www, seguimiento, ancla y barra final', () => {
		expect(normUrl('https://www.ElPais.com/a/b/?utm_source=x&id=3#top')).toBe('elpais.com/a/b?id=3');
		expect(normUrl('http://elpais.com/a/b')).toBe('elpais.com/a/b');
	});
});

describe('mergeSections', () => {
	it('junta el mismo tema de varias secciones por enlace o por titular', () => {
		const groups = mergeSections(
			{
				es: [news('El Gobierno aprueba la ley de vivienda', 'El País', 'https://elpais.com/v', 1, [{ source: 'RTVE', url: 'https://rtve.es/v' }])],
				eco: [
					news('Aprobada la ley de vivienda en el Congreso', 'Expansión', 'https://rtve.es/v/', 2),
					news('El BCE mantiene los tipos', 'BCE', 'https://ecb.europa.eu/1', 3)
				]
			},
			NOW
		);
		expect(groups).toHaveLength(2);
		const vivienda = groups.find((g) => g.title.includes('vivienda'))!;
		expect(vivienda.sources).toEqual(['El País', 'RTVE', 'Expansión']);
		expect(vivienda.links.map((l) => l.source)).toEqual(vivienda.sources);
		expect(vivienda.sections).toEqual(['es', 'eco']);
	});

	it('deja fuera lo de hace más de 48 h y lo que no tiene fecha', () => {
		const old = news('Noticia vieja de hace días', 'BBC', 'https://bbc.co.uk/old', 60);
		const undated = { ...news('Sin fecha ninguna aquí', 'BBC', 'https://bbc.co.uk/x'), time: null };
		expect(mergeSections({ geo: [old, undated] }, NOW)).toEqual([]);
	});
});

describe('track (emparejamiento entre pasadas)', () => {
	const seen: ImpSeen[] = [
		{ k: 'viejo', first: iso(10), last: iso(1), title: 'Terremoto de magnitud 7 en Japón', urls: ['bbc.co.uk/quake'] }
	];

	it('reconoce un tema por un enlace en común aunque cambie el titular principal', () => {
		const [g] = mergeSections({ geo: [news('Japan earthquake: tsunami warning lifted', 'DW', 'https://dw.com/q', 1, [{ source: 'BBC', url: 'https://www.bbc.co.uk/quake' }])] }, NOW);
		const { tracked: [t] } = track([g], seen, NOW);
		expect(t.k).toBe('viejo');
		expect(t.first).toBe(iso(10));
	});

	it('reconoce un tema por un titular parecido', () => {
		const [g] = mergeSections({ geo: [news('Terremoto de magnitud 7 sacude Japón', 'El País', 'https://elpais.com/q')] }, NOW);
		expect(track([g], seen, NOW).tracked[0].k).toBe('viejo');
	});

	it('un tema nuevo empieza ahora y la memoria olvida lo que lleva 48 h sin salir', () => {
		const [g] = mergeSections({ tech: [news('Apple presenta un nuevo iPhone plegable', 'The Verge', 'https://theverge.com/i')] }, NOW);
		const old: ImpSeen = { k: 'olvidado', first: iso(100), last: iso(50), title: 'Algo de hace mucho', urls: [] };
		const out = track([g], [...seen, old], NOW);
		expect(out.tracked[0].k).not.toBe('viejo');
		expect(out.tracked[0].first).toBe(iso(0));
		expect(out.seen.map((s) => s.k)).toContain('viejo');
		expect(out.seen.map((s) => s.k)).not.toContain('olvidado');
	});

	it('dos grupos no heredan la misma clave', () => {
		const groups = mergeSections(
			{
				geo: [news('Terremoto de magnitud 7 en Japón', 'El País', 'https://elpais.com/a')],
				es: [news('Terremoto de magnitud 7 en Japón', 'RTVE', 'https://rtve.es/b', 20)]
			},
			NOW
		);
		expect(groups).toHaveLength(2);
		const keys = track(groups, seen, NOW).tracked.map((t) => t.k);
		expect(new Set(keys).size).toBe(2);
	});
});

describe('confirms (fuentes oficiales)', () => {
	it('pide 3 palabras clave en común y el 40 % del tema', () => {
		const topic = keywords('El Gobierno aprueba la reducción de la jornada laboral a 37,5 horas');
		expect(confirms(topic, keywords('Real Decreto por el que se aprueba la reducción de la jornada laboral'))).toBe(true);
		expect(confirms(topic, keywords('Orden sobre la jornada de los funcionarios'))).toBe(false);
	});

	it('las palabras generales y los años no cuentan', () => {
		expect([...keywords('El Gobierno de España y el presidente en 2026')]).toEqual([]);
	});
});

describe('scoreGroups', () => {
	const input = { now: NOW, official: [], itn: [] };

	it('aplica la fórmula: medios, secciones, horas vivo, oficial y Wikipedia', () => {
		const [s] = scoreGroups([tracked({ sources: ['A', 'B', 'C'], sections: ['es', 'eco'], first: iso(12) })], input);
		// 2·2 + 1,5·1 + 12/6
		expect(s.score).toBe(7.5);
		const [long] = scoreGroups([tracked({ first: iso(48) })], input);
		expect(long.score).toBe(4);
	});

	it('suma 3 si lo confirma una fuente oficial y 3 si sale en «In the news»', () => {
		const g = tracked({ title: 'Trump signs executive order on tariffs for steel imports', sources: ['CNBC', 'WSJ'] });
		const [s] = scoreGroups([g], {
			now: NOW,
			official: [{ source: 'Casa Blanca', title: 'President Trump signs order adjusting tariffs on steel imports' }],
			itn: ['The United States imposes new tariffs on steel imports after Trump signs an order.']
		});
		expect(s.official).toBe('Casa Blanca');
		expect(s.wiki).toBe(true);
		expect(s.score).toBe(2 + 3 + 3);
	});

	it('un comunicado oficial solo, sin prensa, no se lleva el extra', () => {
		const [s] = scoreGroups([tracked({ sources: ['La Moncloa'] })], input);
		expect(s.official).toBeUndefined();
		const [both] = scoreGroups([tracked({ sources: ['La Moncloa', 'El País'] })], input);
		expect(both.official).toBe('La Moncloa');
		expect(both.score).toBe(2 + 3);
	});

	it('ordena por puntuación y, a igualdad, por más medios', () => {
		const out = scoreGroups(
			[
				tracked({ k: 'a', sources: ['A'], first: iso(12) }),
				tracked({ k: 'b', sources: ['A', 'B'] }),
				tracked({ k: 'c', sources: ['A', 'B', 'C', 'D'] })
			],
			input
		);
		expect(out.map((o) => o.k)).toEqual(['c', 'b', 'a']);
	});
});

describe('mergeDay', () => {
	it('cada tema se queda con lo máximo del día y se juntan sus medios', () => {
		const day = [{ k: 'a', title: 'A', url: 'u', sources: ['X'], score: 9 }];
		const now = [
			{ k: 'a', title: 'A2', url: 'u2', sources: ['Y'], score: 5 },
			{ k: 'b', title: 'B', url: 'v', sources: ['Z'], score: 7 }
		];
		expect(mergeDay(day, now)).toEqual([
			{ k: 'a', title: 'A', url: 'u', sources: ['X', 'Y'], score: 9 },
			{ k: 'b', title: 'B', url: 'v', sources: ['Z'], score: 7 }
		]);
		expect(mergeDay(day, now, 1)).toHaveLength(1);
	});
});

describe('fuente imp', () => {
	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it('usa los datos de esta pasada, guarda el top del día y sigue sin Wikipedia', async () => {
		vi.useFakeTimers({ toFake: ['Date'] });
		vi.setSystemTime(NOW);
		mockFetch(() => undefined);
		const sections: Record<string, NewsItem[]> = {
			'news-es': [news('Huelga general convocada en toda España', 'El País', 'https://elpais.com/h', 1, [{ source: 'RTVE', url: 'https://rtve.es/h' }])],
			'news-eco': [news('Huelga general convocada en toda España', 'Expansión', 'https://expansion.com/h', 2)]
		};
		const ctx = makeContext(new Map(Object.entries(sections).map(([k, items]) => [k, { items, feeds: [] }])));
		const previous: ImpData = { date: '2026-10-13', current: [], days: [{ date: '2026-10-13', items: [{ k: 'x', title: 'X', url: 'u', sources: ['A'], score: 1, links: [{ source: 'A', url: 'u' }] }] }], seen: [] };
		const data = await imp.fetch(previous, ctx);
		expect(data.date).toBe('2026-10-14');
		expect(data.current).toHaveLength(1);
		expect(data.current[0]).toMatchObject({ sources: ['El País', 'RTVE', 'Expansión'], sections: ['es', 'eco'], score: 5.5 });
		expect(data.days.map((d) => d.date)).toEqual(['2026-10-13', '2026-10-14']);
		expect(data.days[0].items[0]).not.toHaveProperty('links');
		expect(data.current[0].links).toEqual([
			{ source: 'El País', url: 'https://elpais.com/h' },
			{ source: 'RTVE', url: 'https://rtve.es/h' },
			{ source: 'Expansión', url: 'https://expansion.com/h' }
		]);
		expect(Object.keys(data.days[1].items[0])).toEqual(['k', 'title', 'url', 'sources', 'score', 'links']);
		expect(data.seen).toHaveLength(1);
	});

	it('falla si no hay titulares recientes', async () => {
		await expect(imp.fetch(undefined, makeContext(new Map()))).rejects.toThrow();
	});
});
