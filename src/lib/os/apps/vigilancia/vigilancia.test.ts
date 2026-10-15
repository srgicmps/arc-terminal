import { describe, expect, it } from 'vitest';
import type { ImpCurrent, NewsItem, Quake } from '../../../types.ts';
import {
	allHeadlines,
	assess,
	byLevel,
	changes,
	hashOf,
	levelOf,
	mergeSeen,
	parseState,
	snapshot,
	type Feeds
} from './intel.ts';
import { alertPlan, cleanTargets, examples, inAlerts, labelOf, matcher, suggest, targetFromQuery } from './targets.ts';

const NOW = Date.parse('2026-10-15T12:00:00Z');
const ago = (h: number) => new Date(NOW - h * 3_600_000).toISOString();
const news = (title: string, h: number): NewsItem => ({ title, url: `https://x/${encodeURIComponent(title)}`, source: 'BBC', time: ago(h), summary: '' });
const imp = (title: string, media: number): ImpCurrent => ({
	k: title,
	title,
	url: 'https://imp',
	sources: Array.from({ length: media }, (_, i) => `M${i}`),
	score: 10,
	sections: ['geo'],
	first: ago(2),
	time: ago(1)
});
const feeds = (over: Partial<Feeds> = {}): Feeds => ({ imp: null, news: [], quakes: [], quotes: [], ...over });

describe('objetivos', () => {
	it('normaliza: descarta lo que no existe, repetidos y palabras raras', () => {
		const t = cleanTargets([
			{ kind: 'country', id: 'JP' },
			{ kind: 'country', id: 'JP' },
			{ kind: 'country', id: 'XX' },
			{ kind: 'ticker', id: 'NVDA' },
			{ kind: 'leader', id: 'lagarde' },
			{ kind: 'word', id: '  Aranceles ' },
			{ kind: 'word', id: 'aranceles' },
			{ kind: 'word', id: '<script>' },
			'basura',
			{ kind: 'otro', id: 'x' }
		]);
		expect(t).toEqual([
			{ kind: 'country', id: 'JP' },
			{ kind: 'ticker', id: 'NVDA' },
			{ kind: 'leader', id: 'lagarde' },
			{ kind: 'word', id: 'Aranceles' }
		]);
		expect(cleanTargets('nada')).toEqual([]);
		expect(cleanTargets(Array.from({ length: 40 }, (_, i) => ({ kind: 'word', id: `w${i}` }))).length).toBe(24);
	});

	it('lo escrito se convierte en un valor, un líder, un país o una palabra', () => {
		expect(targetFromQuery('nvda')).toEqual({ kind: 'ticker', id: 'NVDA' });
		expect(targetFromQuery('Lagarde')).toEqual({ kind: 'leader', id: 'lagarde' });
		expect(targetFromQuery('japón')).toEqual({ kind: 'country', id: 'JP' });
		expect(targetFromQuery('BCE')).toEqual({ kind: 'word', id: 'BCE' });
		expect(targetFromQuery('aranceles')).toEqual({ kind: 'word', id: 'aranceles' });
		expect(targetFromQuery('  ')).toBeNull();
		expect(suggest('jap').some((t) => t.kind === 'country' && t.id === 'JP')).toBe(true);
		expect(labelOf({ kind: 'ticker', id: 'NVDA' })).toBe('NVIDIA · NVDA');
	});

	it('reconoce los titulares que lo nombran', () => {
		expect(matcher({ kind: 'country', id: 'KP' })('Corea del Norte lanza un misil')).toBe(true);
		expect(matcher({ kind: 'country', id: 'KR' })('Corea del Norte lanza un misil')).toBe(false);
		expect(matcher({ kind: 'ticker', id: 'NVDA' })('la nvidia beats')).toBe(false);
		expect(matcher({ kind: 'ticker', id: 'NVDA' })('Nvidia beats estimates')).toBe(true);
		expect(matcher({ kind: 'ticker', id: 'AMD' })('AMD sube un 5 %')).toBe(true);
		expect(matcher({ kind: 'leader', id: 'lagarde' })('Lagarde avisa sobre la inflación')).toBe(true);
		expect(matcher({ kind: 'word', id: 'aranceles' })('Nuevos ARANCELES de EE. UU.')).toBe(true);
		expect(matcher({ kind: 'word', id: 'aranceles' })('arancelesx')).toBe(false);
	});

	it('el aviso: un valor de EE. UU. va a tus valores; lo demás, como palabra', () => {
		expect(alertPlan({ kind: 'ticker', id: 'NVDA' })).toEqual({ kind: 'mis', value: 'NVDA' });
		expect(alertPlan({ kind: 'ticker', id: 'ITX' })).toEqual({ kind: 'word', value: 'Inditex' });
		expect(alertPlan({ kind: 'country', id: 'JP' })).toEqual({ kind: 'word', value: 'Japón' });
		expect(alertPlan({ kind: 'leader', id: 'lagarde' })).toEqual({ kind: 'word', value: 'Christine Lagarde' });
		expect(inAlerts({ kind: 'country', id: 'JP' }, { mis: [], words: ['japon'] })).toBe(true);
		expect(inAlerts({ kind: 'ticker', id: 'NVDA' }, { mis: ['AAPL'], words: [] })).toBe(false);
	});

	it('ejemplos: de MIS y países favoritos; si no hay, unos generales', () => {
		expect(examples(['NASDAQ:NVDA', 'AAPL'], ['JP'])).toEqual([
			{ kind: 'country', id: 'JP' },
			{ kind: 'ticker', id: 'NVDA' },
			{ kind: 'ticker', id: 'AAPL' }
		]);
		expect(examples([], []).length).toBeGreaterThan(3);
	});
});

describe('nivel', () => {
	const base = { count24: 0, baseline: 0, impMedia: 0, quakeMag: 0, changePct: null };
	it('sin nada, calma; con menciones normales, normal', () => {
		expect(levelOf(base).level).toBe(0);
		expect(levelOf({ ...base, count24: 2, baseline: 2 }).level).toBe(1);
	});
	it('sube con un pico de menciones, IMP, terremotos y movimientos del valor', () => {
		expect(levelOf({ ...base, count24: 4, baseline: 1 }).level).toBe(2);
		expect(levelOf({ ...base, count24: 9, baseline: 1 }).level).toBe(3);
		expect(levelOf({ ...base, count24: 9, baseline: 1, impMedia: 8, quakeMag: 7 }).level).toBe(4);
		expect(levelOf({ ...base, changePct: -6.5 }).why[0]).toContain('6,5 %');
		// Muchas menciones pero en su media: no sube.
		expect(levelOf({ ...base, count24: 9, baseline: 9 }).level).toBe(1);
	});
});

describe('estado de un objetivo', () => {
	it('cuenta menciones de 24 h frente a su media, terremotos del país y la cotización', () => {
		const f = feeds({
			imp: { date: '2026-10-15', current: [imp('Japan election shock', 7)], days: [{ date: '2026-10-14', items: [] }], seen: [] },
			news: [
				{ items: [news('Japón sube tipos', 2), news('El yen y Japón', 3), news('Tokio: Japan stocks', 5), news('Japón ayer', 40)], feeds: [] }
			],
			quakes: [{ id: 'q', mag: 6.8, place: '50 km E of Sendai, Japan', time: ago(3), url: 'u', tsunami: false, alert: null, lat: 0, lon: 0, depth: 10 } as Quake],
			quotes: [{ symbol: 'NVDA', price: 120, change: -8, changePct: -6.2, prevClose: 128, time: ago(1) }]
		});
		const heads = allHeadlines(f);
		const jp = assess({ kind: 'country', id: 'JP' }, f, heads, NOW);
		expect(jp.count24).toBe(4);
		expect(jp.geo).toHaveLength(1);
		expect(jp.level).toBe(4);
		expect(jp.headlines[0].imp).toBe(true);
		const nv = assess({ kind: 'ticker', id: 'NVDA' }, f, heads, NOW);
		expect(nv.quote?.price).toBe(120);
		expect(nv.level).toBe(2);
		expect(byLevel([{ a: nv }, { a: jp }]).map((x) => x.a.key)).toEqual(['country:JP', 'ticker:NVDA']);
	});
});

describe('desde tu última visita', () => {
	const f = feeds({ news: [{ items: [news('Japón A', 1), news('Japón B', 2)], feeds: [] }] });
	const jp = () => assess({ kind: 'country', id: 'JP' }, f, allHeadlines(f), NOW);

	it('marca solo los titulares que no había visto, y el cambio de nivel', () => {
		const a = jp();
		const ref = { h: [hashOf('Japón A')], l: 0 as const };
		const c = changes(a, ref);
		expect([...c.fresh]).toEqual([hashOf('Japón B')]);
		expect(c.levelWas).toBe(0);
		expect(changes(a, undefined)).toMatchObject({ known: false, fresh: new Set() });
	});

	it('la huella no mira mayúsculas, tildes ni signos', () => {
		expect(hashOf('Japón, sube')).toBe(hashOf('japon sube'));
		expect(hashOf('a')).not.toBe(hashOf('b'));
	});

	it('guarda y vuelve a leer el estado, sin objetivos ni huellas raras', () => {
		const a = jp();
		const seen = mergeSeen({ 'country:JP': { h: ['old'], l: 1 } }, snapshot([a]), ['country:JP']);
		expect(seen['country:JP'].h).toContain('old');
		const state = parseState(
			{ targets: [{ kind: 'country', id: 'JP' }], at: '2026-10-15T10:00:00Z', seen: { ...seen, 'country:XX': { h: [], l: 0 }, 'country:JP2': 3 } },
			cleanTargets
		);
		expect(state.targets).toHaveLength(1);
		expect(Object.keys(state.seen)).toEqual(['country:JP']);
		expect(parseState(null, cleanTargets)).toEqual({ targets: [], at: null, seen: {} });
		expect(parseState({ at: 'no', seen: { 'country:JP': { h: ['!!'], l: 9 } } }, cleanTargets).at).toBeNull();
	});
});

describe('bancos centrales como tema', () => {
	it('«Fed» no casa con el verbo inglés «fed»', () => {
		const fed = matcher({ kind: 'word', id: 'Fed' });
		expect(fed('The Fed holds rates')).toBe(true);
		expect(fed('La Fed mantiene los tipos')).toBe(true);
		expect(fed('Investors fed up with tariffs')).toBe(false);
		expect(matcher({ kind: 'word', id: 'BCE' })('El BCE sube tipos')).toBe(true);
		// Una palabra cualquiera sigue sin mirar mayúsculas.
		expect(matcher({ kind: 'word', id: 'Aranceles' })('Nuevos aranceles a China')).toBe(true);
	});
});
