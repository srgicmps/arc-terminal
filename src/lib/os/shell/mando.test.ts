import { describe, expect, it } from 'vitest';
import type { SourceStatus } from '../../data.ts';
import { alertLevel, dateTag, feedHealth, feeds, hms, sourcesLive } from './mando.ts';

const h = (sources: number) => ({ title: 't', sources, first: '2026-10-15T10:00:00Z' });
const a = (title: string) => ({ kind: 'noticia' as const, title, detail: '', time: '2026-10-15T10:00:00Z' });
const s = (name: string, state: SourceStatus['state']): SourceStatus => ({ name, label: name, state, fetchedAt: '2026-10-15T10:00:00Z' });

describe('alertLevel', () => {
	it('sin muro no dice «Normal»: nivel 0, sin datos', () => {
		expect(alertLevel(null)).toMatchObject({ level: 0, label: 'Sin datos' });
	});
	it('sin avisos, normal', () => {
		expect(alertLevel({ alerts: [], headlines: [h(3)] })).toMatchObject({ level: 1, label: 'Normal' });
	});
	it('sube con temas grandes y avisos', () => {
		expect(alertLevel({ alerts: [], headlines: [h(5)] }).level).toBe(2);
		expect(alertLevel({ alerts: [a('x')], headlines: [h(2)] }).level).toBe(3);
		expect(alertLevel({ alerts: [a('x'), a('y')], headlines: [h(6)] }).level).toBe(4);
		const max = alertLevel({ alerts: [a('1'), a('2'), a('3'), a('4')], headlines: [] });
		expect(max).toMatchObject({ level: 5, label: 'Máximo' });
		expect(max.reasons).toContain('y 1 avisos más');
	});
});

describe('alertLevel con la hora', () => {
	const now = Date.parse('2026-10-15T12:00:00Z');
	it('un muro viejo no sube el nivel: avisos de más de 3 h y temas de más de un día no cuentan', () => {
		const old = { kind: 'terremoto' as const, title: 'M7', detail: '', time: '2026-10-12T10:00:00Z' };
		const oldTopic = { title: 'viejo', sources: 9, first: '2026-10-13T10:00:00Z' };
		expect(alertLevel({ alerts: [old], headlines: [oldTopic] }, now).level).toBe(1);
		expect(alertLevel({ alerts: [old], headlines: [oldTopic] }).level).toBe(4); // sin hora, como antes
	});
	it('la misma historia no cuenta como aviso y como tema', () => {
		const al = { kind: 'noticia' as const, title: 'Aranceles', detail: '', time: '2026-10-15T11:00:00Z' };
		const top = { title: 'Aranceles', sources: 9, first: '2026-10-15T10:00:00Z' };
		expect(alertLevel({ alerts: [al], headlines: [top] }, now).level).toBe(3);
	});
});

describe('fuentes', () => {
	const st = [s('imp', 'ok'), s('news', 'stale'), s('quakes', 'error'), s('gdacs', 'error'), s('fred', 'off'), s('ecb', 'cached')];
	it('piloto por grupo', () => {
		expect(feedHealth(st, ['imp', 'news'])).toBe('degradado');
		expect(feedHealth(st, ['quakes', 'gdacs'])).toBe('caido');
		expect(feedHealth(st, ['ecb', 'fred'])).toBe('ok');
		expect(feedHealth(st, ['fred'])).toBe('sin-datos');
		expect(feeds(st).map((f) => f.id)).toEqual(['imp', 'geo', 'mkt', 'mac']);
	});
	it('el piloto de IMP mira los titulares (news-*), no una fuente «news» que no existe', () => {
		const st2 = [s('imp', 'ok'), s('news-geo', 'error')];
		expect(feeds(st2)[0].health).toBe('degradado');
	});
	it('con datos parados (las Actions no publican), deja de estar en verde', () => {
		const now = Date.parse('2026-10-15T10:00:00Z');
		const old: SourceStatus = { ...s('quakes', 'ok'), maxAgeMinutes: 15 };
		expect(feedHealth([old], ['quakes'], now)).toBe('ok');
		expect(feedHealth([old], ['quakes'], now + 3 * 3_600_000)).toBe('caido');
		expect(sourcesLive([old], now + 3 * 3_600_000)).toEqual({ live: 0, total: 1 });
	});
	it('cuenta las que van sin las que no tienen clave', () => {
		expect(sourcesLive(st)).toEqual({ live: 2, total: 5 });
	});
});

describe('relojes', () => {
	const t = Date.parse('2026-10-15T08:05:09Z');
	it('hora con segundos y fecha de parte', () => {
		expect(hms('UTC', t)).toBe('08:05:09');
		expect(hms('Europe/Madrid', t)).toBe('10:05:09');
		expect(dateTag('UTC', t)).toBe('15 OCT 2026');
	});
});
