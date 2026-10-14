import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Quake } from '../../src/lib/types.ts';
import type { Level } from '../alerts/config.ts';
import { emptyLog, type Draft, type LogEntry, type NotifyLog, type Rule } from '../alerts/rules.ts';
import {
	baselineLog,
	encodeHeader,
	headers,
	newestLog,
	parseLog,
	pickAlerts,
	runNotify,
	trim,
	usedToday
} from '../notify.ts';
import { mockFetch } from './mock.ts';

// 14 oct 2026, 12:00 en Madrid (CEST).
const NOW = Date.parse('2026-10-14T10:00:00Z');
const HOUR = 3_600_000;
const TOPIC = 'arc-secreto-Xy9q7ZpL2';

/** Una regla de prueba que devuelve `n` avisos de nivel `level`; el i-ésimo, `i` minutos más antiguo. */
const fake = (type: string, level: Level, n: number): Rule => ({
	type,
	level,
	run: (): Draft[] =>
		Array.from({ length: n }, (_, i) => ({
			id: `${type}:${i}`,
			title: type,
			body: '',
			tags: '',
			click: '',
			time: NOW - i * 60_000
		}))
});

const sent = (n: number, p: Level, t = '2026-10-14T07:00Z', prefix = `old${p}`): LogEntry[] =>
	Array.from({ length: n }, (_, i) => ({ k: `${prefix}:${i}`, t, s: 'sent' as const, p }));

const pick = (rules: Rule[], entries: LogEntry[] = [], now = NOW) =>
	pickAlerts({}, { ...emptyLog(), entries }, now, rules);
const count = (alerts: { level: Level }[], level: Level) => alerts.filter((a) => a.level === level).length;

describe('cupos y tope diario', () => {
	it('P1 sin cupo propio, P2 hasta 25, P3 hasta 15, P4 hasta 2', () => {
		const { send, skipped } = pick([fake('a', 1, 10), fake('b', 2, 30), fake('c', 3, 20), fake('d', 4, 3)]);
		expect([1, 2, 3, 4].map((l) => count(send, l as Level))).toEqual([10, 25, 15, 0]);
		// 10 + 25 + 15 = 50: el tope total deja fuera a P4 y lo que no cabía en su cupo.
		expect(send).toHaveLength(50);
		expect(skipped).toHaveLength(5 + 5 + 3);
	});

	it('tope de 50 al día: si se llega, gana el nivel más alto', () => {
		const { send } = pick([fake('p3', 3, 10), fake('p2', 2, 10), fake('p1', 1, 45)]);
		expect([count(send, 1), count(send, 2), count(send, 3)]).toEqual([45, 5, 0]);
		const later = pick([fake('p1', 1, 5)], sent(50, 3, '2026-10-14T07:00Z'));
		expect(later.send).toEqual([]);
	});

	it('cuenta lo de hoy en Madrid: lo de ayer y lo visto sin enviar no cuentan', () => {
		const entries = [
			...sent(20, 2, '2026-10-14T06:00Z'),
			...sent(30, 2, '2026-10-13T21:00Z', 'ayer'), // 23:00 CEST del 13
			{ k: 'b', t: '2026-10-14T07:00Z', s: 'baseline' as const, p: 2 as const },
			{ k: 'f', t: '2026-10-14T08:00Z', s: 'failed' as const, p: 3 as const }
		];
		expect(usedToday({ ...emptyLog(), entries }, NOW)).toEqual({ total: 21, byLevel: { 1: 0, 2: 20, 3: 1, 4: 0 } });
		expect(count(pick([fake('x', 2, 10)], entries).send, 2)).toBe(5);
	});

	it('orden: nivel más alto primero y, a igual nivel, el más reciente', () => {
		const { send } = pick([fake('p3', 3, 2), fake('p1', 1, 2), fake('p2', 2, 2)]);
		expect(send.map((a) => a.id)).toEqual(['p1:0', 'p1:1', 'p2:0', 'p2:1', 'p3:0', 'p3:1']);
		const tight = pick([fake('p3', 3, 2), fake('p1', 1, 2), fake('p2', 2, 2)], sent(47, 1));
		expect(tight.send.map((a) => a.id)).toEqual(['p1:0', 'p1:1', 'p2:0']);
		expect(tight.skipped.map((a) => a.id)).toEqual(['p2:1', 'p3:0', 'p3:1']);
	});

	it('un id ya apuntado (enviado, fallido o visto) no se repite nunca', () => {
		for (const s of ['sent', 'failed', 'baseline'] as const) {
			expect(pick([fake('a', 1, 2)], [{ k: 'a:0', t: '2026-10-10T10:00Z', s }]).send.map((a) => a.id)).toEqual(['a:1']);
		}
	});

	it('los resúmenes salen una sola vez al día (lo controla el id)', () => {
		const at = Date.parse('2026-10-14T06:05:00Z'); // 08:05 CEST
		const first = pickAlerts({}, emptyLog(), at);
		expect(first.send.map((a) => a.id)).toEqual(['morning:2026-10-14']);
		const log: NotifyLog = {
			...emptyLog(),
			entries: [{ k: 'morning:2026-10-14', t: '2026-10-14T06:05Z', s: 'sent', p: 4 }]
		};
		expect(pickAlerts({}, log, at + 15 * 60_000).send).toEqual([]);
		expect(pickAlerts({}, log, Date.parse('2026-10-15T06:05:00Z')).send.map((a) => a.id)).toEqual([
			'morning:2026-10-15'
		]);
	});

	it('se envía a cualquier hora, también de madrugada', () => {
		expect(pick([fake('a', 1, 1)], [], Date.parse('2026-10-25T02:30:00Z')).send).toHaveLength(1); // 03:30 CET
	});
});

describe('historial', () => {
	it('trim deja 7 días de intentos y conserva los valores que se comparan', () => {
		const log: NotifyLog = {
			...emptyLog(),
			entries: [
				{ k: 'viejo', t: '2026-10-06T09:00Z', s: 'sent' },
				{ k: 'nuevo', t: '2026-10-08T11:00Z', s: 'sent' }
			],
			last: { 'macro:ipc-es': '2026-09' }
		};
		const out = trim(log, NOW);
		expect(out.entries.map((e) => e.k)).toEqual(['nuevo']);
		expect(out.last).toEqual({ 'macro:ipc-es': '2026-09' });
	});

	it('sin historial, todo lo de ahora queda como visto y no se envía nada', () => {
		const quake: Quake = {
			id: 'a',
			mag: 7.2,
			place: 'X',
			time: new Date(NOW - HOUR).toISOString(),
			url: '',
			tsunami: false,
			alert: null,
			lat: 0,
			lon: 0,
			depth: 10
		};
		const d = {
			quakes: [quake],
			ine: { series: [{ id: 'ipc-es', label: '', unit: '%', source: '', points: [{ t: '2026-09', v: 2.9 }] }] }
		};
		const log = baselineLog(d, NOW);
		expect(log.entries).toEqual([{ k: 'quake:a', t: '2026-10-14T10:00Z', s: 'baseline', p: 1 }]);
		expect(log.last['macro:ipc-es']).toBe('2026-09');
		expect(pickAlerts(d, log, NOW).send).toEqual([]);
	});

	it('entre la caché y el publicado gana el que tiene el último intento; a igualdad, la caché', () => {
		const at = (t: string, k = t): NotifyLog => ({ ...emptyLog(), entries: [{ k, t, s: 'sent' }] });
		const cached = at('2026-10-14T10:00Z', 'cache');
		const published = at('2026-10-14T09:45Z', 'web');
		expect(newestLog(cached, published)).toBe(cached);
		expect(newestLog(published, at('2026-10-14T10:15Z', 'web'))?.entries[0].k).toBe('web');
		expect(newestLog(at('2026-10-14T10:00Z', 'cache'), at('2026-10-14T10:00Z', 'web'))?.entries[0].k).toBe('cache');
		expect(newestLog(null, published)).toBe(published);
		expect(newestLog(cached, null)).toBe(cached);
		expect(newestLog(null, null)).toBeNull();
		expect(newestLog(emptyLog(), published)).toBe(published);
	});

	it('parseLog tolera historiales viejos o rotos', () => {
		expect(parseLog(null)).toBeNull();
		expect(parseLog({ data: { entries: 'x' } })).toBeNull();
		expect(
			parseLog({ data: { entries: [{ k: 'a', t: '2026-10-14T10:00Z', s: 'sent' }, { k: 1 }], last: { a: 'b', c: 3 } } })
		).toEqual({
			entries: [{ k: 'a', t: '2026-10-14T10:00Z', s: 'sent' }],
			last: { a: 'b' },
			assets: {},
			poly: {}
		});
	});
});

describe('ntfy', () => {
	const alert = (level: Level, markdown = false) => ({
		id: 'x',
		type: 'x',
		level,
		title: 'Fuente caída',
		body: '',
		tags: 'warning',
		click: 'https://srgicmps.github.io/arc-terminal/geo',
		time: NOW,
		markdown
	});

	it('Priority 5/4/3/2 para P1–P4 y X-Markdown en los resúmenes', () => {
		expect([1, 2, 3, 4].map((l) => headers(alert(l as Level)).Priority)).toEqual(['5', '4', '3', '2']);
		expect(headers(alert(4, true))['X-Markdown']).toBe('yes');
		expect(headers(alert(1))['X-Markdown']).toBeUndefined();
	});

	it('el título con acentos va en RFC 2047', () => {
		expect(encodeHeader('Mercados')).toBe('Mercados');
		expect(encodeHeader('Fuente caída')).toBe(`=?UTF-8?B?${Buffer.from('Fuente caída').toString('base64')}?=`);
	});
});

describe('runNotify', () => {
	let dir: string;
	let logged: string[];
	const quake = (id: string, mag: number, hoursAgo: number): Quake => ({
		id,
		mag,
		place: 'Lugar de prueba',
		time: new Date(NOW - hoursAgo * HOUR).toISOString(),
		url: '',
		tsunami: false,
		alert: null,
		lat: 0,
		lon: 0,
		depth: 10
	});

	beforeEach(async () => {
		dir = await mkdtemp(join(tmpdir(), 'notify-'));
		logged = [];
		vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => void logged.push(args.map(String).join(' ')));
		await writeFile(
			join(dir, 'quakes.json'),
			JSON.stringify({ name: 'quakes', fetchedAt: '', data: [quake('a', 7.2, 1), quake('b', 7.6, 0.5)] })
		);
	});

	afterEach(async () => {
		await rm(dir, { recursive: true, force: true });
	});

	const published = (log: NotifyLog) => ({ name: 'notify-log', fetchedAt: '', data: log });
	const written = async () => readFile(join(dir, 'notify-log.json'), 'utf8');

	it('sin NTFY_TOPIC no hace nada y lo dice sin más', async () => {
		const fetch = mockFetch(() => undefined);
		const lines = await runNotify({ topic: undefined, dir, now: NOW });
		expect(lines).toEqual(['ntfy: sin tema configurado (NTFY_TOPIC), no se envía nada']);
		expect(fetch).not.toHaveBeenCalled();
	});

	it('envía con las cabeceras de ntfy; un 429 se descarta sin romper; el tema no sale en registros ni en el JSON', async () => {
		const calls: { url: string; init?: RequestInit }[] = [];
		mockFetch((url, init) => {
			if (url.endsWith('/data/notify-log.json')) return published(emptyLog());
			if (url.startsWith('https://ntfy.sh/')) {
				calls.push({ url, init });
				// ntfy devuelve el tema en la respuesta: no debe acabar en ningún sitio.
				return calls.length === 1
					? Response.json({ topic: TOPIC }, { status: 200 })
					: new Response(`{"error":"limit","topic":"${TOPIC}"}`, { status: 429 });
			}
		});
		const lines = await runNotify({ topic: TOPIC, dir, now: NOW });
		expect(calls).toHaveLength(2);
		expect(calls[0].url).toBe(`https://ntfy.sh/${TOPIC}`);
		const h = calls[0].init?.headers as Record<string, string>;
		expect(h.Priority).toBe('5');
		expect(h.Tags).toBe('warning');
		expect(h.Click).toBe('https://srgicmps.github.io/arc-terminal/geo');
		expect(lines).toEqual(['ntfy · P1 quake:b: enviado (200)', 'ntfy · P1 quake:a: 429, se descarta']);
		const json = await written();
		expect(JSON.parse(json).data.entries).toEqual([
			{ k: 'quake:b', t: '2026-10-14T10:00Z', s: 'sent', p: 1 },
			{ k: 'quake:a', t: '2026-10-14T10:00Z', s: 'failed', p: 1 }
		]);
		for (const text of [...logged, ...lines, json]) expect(text).not.toContain(TOPIC);
	});

	it('un error de red con la URL en el mensaje se registra saneado', async () => {
		mockFetch((url) => {
			if (url.endsWith('/data/notify-log.json')) return published(emptyLog());
			throw new Error(`connect ECONNREFUSED ${url}?auth=x`);
		});
		const lines = await runNotify({ topic: TOPIC, dir, now: NOW });
		expect(lines.filter((l) => l.includes('sin respuesta') && l.includes('se descarta'))).toHaveLength(2);
		for (const text of [...logged, await written()]) expect(text).not.toContain(TOPIC);
	});

	it('si la web no se publicó tras enviar, lee la caché y no repite; y la reescribe', async () => {
		const cache = join(dir, 'cache', 'notify-log.json');
		const route = (url: string) => {
			// La web sigue con el historial de antes de enviar (el deploy falló).
			if (url.endsWith('/data/notify-log.json')) return published(emptyLog());
			if (url.startsWith('https://ntfy.sh/')) return new Response('', { status: 200 });
		};
		const fetch = mockFetch(route);
		await runNotify({ topic: TOPIC, dir, cache, now: NOW });
		const ntfy = () => fetch.mock.calls.filter(([u]) => String(u).includes('ntfy.sh')).length;
		expect(ntfy()).toBe(2);
		const saved = JSON.parse(await readFile(cache, 'utf8'));
		expect(saved.data.entries.map((e: { k: string }) => e.k)).toEqual(['quake:b', 'quake:a']);
		await runNotify({ topic: TOPIC, dir, cache, now: NOW + 15 * 60_000 });
		expect(ntfy()).toBe(2);
		expect(await readFile(cache, 'utf8')).not.toContain(TOPIC);
	});

	it('sin historial publicado solo envía el aviso de prueba y apunta lo de ahora como visto', async () => {
		const fetch = mockFetch(() => undefined);
		const lines = await runNotify({ topic: TOPIC, dir, now: NOW });
		const sent = fetch.mock.calls.filter(([u]) => String(u).includes('ntfy.sh'));
		expect(sent).toHaveLength(1);
		expect(String(sent[0][1]?.body)).toContain('Los avisos llegarán por aquí');
		const json = await written();
		expect(JSON.parse(json).data.entries.map((e: { k: string; s: string }) => e.k === 'hello' || e.s)).toEqual([
			'baseline',
			'baseline',
			true
		]);
		for (const text of [...logged, ...lines, json]) expect(text).not.toContain(TOPIC);
	});
});
